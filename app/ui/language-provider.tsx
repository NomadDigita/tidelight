"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from "react";
import zhCN from "@/app/i18n/zh-CN.json";

export type Language = "en" | "zh-CN";
const STORAGE_KEY = "tidelight-language";
type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void };
const LanguageContext = createContext<LanguageContextValue>({ language: "en", setLanguage: () => {} });
const messages = zhCN as Record<string, string>;
const watchedAttributes = ["aria-label", "aria-description", "placeholder", "title", "alt", "data-tooltip", "value"];

function readLanguage(): Language {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "zh-CN" || stored === "en") return stored;
  } catch {
    // The cookie remains a fallback when storage is disabled by the browser.
  }
  return document.cookie.split(";").some((part) => part.trim() === `${STORAGE_KEY}=zh-CN`) ? "zh-CN" : "en";
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("tidelight:language-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("tidelight:language-change", callback);
  };
}

function normalized(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function translateWithSpacing(source: string) {
  const key = normalized(source);
  const translated = messages[key];
  if (!translated || translated === key) return null;
  // Text nodes can include separate inline elements (for example "The <em>method</em>").
  // Translate only when the entire node is a glossary entry; never replace a brand
  // name or a short word inside a longer phrase.
  const leading = source.match(/^\s*/)?.[0] ?? "";
  const trailing = source.match(/\s*$/)?.[0] ?? "";
  return `${leading}${translated}${trailing}`;
}

export function LanguageProvider({ children, initialLanguage }: { children: ReactNode; initialLanguage: Language }) {
  const language = useSyncExternalStore<Language>(subscribe, readLanguage, () => initialLanguage);
  const textSources = useRef(new WeakMap<Text, string>());
  const appliedText = useRef(new WeakMap<Text, string>());
  const attributeSources = useRef(new WeakMap<Element, Map<string, string>>());
  const appliedAttributes = useRef(new WeakMap<Element, Map<string, string>>());

  const setLanguage = useCallback((next: Language) => {
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* Cookie still persists the selection for this browser. */ }
    document.cookie = `${STORAGE_KEY}=${next}; path=/; max-age=31536000; samesite=lax`;
    window.dispatchEvent(new Event("tidelight:language-change"));
  }, []);

  useEffect(() => {
    let observer: MutationObserver | null = null;
    const timer = window.setTimeout(() => {
    document.documentElement.lang = language;
    document.documentElement.dataset.language = language;
    document.title = language === "zh-CN" ? "Tidelight — 看清交易时段之间的市场信号" : "Tidelight — See the signal between sessions";
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (description) description.content = language === "zh-CN"
      ? "面向代币化美股的市场研究工作台。沿着市场事件、证据、影响敞口和情景，做出更清晰的判断。"
      : "An after-hours research desk for tokenized US equities. Follow market events with clear context, scenarios, and sources.";

    const translateText = (node: Text) => {
      const current = node.nodeValue ?? "";
      const applied = appliedText.current.get(node);
      let source = textSources.current.get(node);
      if (applied !== undefined && current !== applied) {
        source = current;
        textSources.current.set(node, current);
        appliedText.current.delete(node);
      } else if (source === undefined) {
        source = current;
        textSources.current.set(node, current);
      }
      if (language === "en") {
        if (applied !== undefined && current === applied && source !== current) node.nodeValue = source;
        appliedText.current.delete(node);
        return;
      }
      const translated = translateWithSpacing(source);
      if (translated && translated !== current) {
        node.nodeValue = translated;
        appliedText.current.set(node, translated);
      }
    };

    const getAttrMap = (weakMap: WeakMap<Element, Map<string, string>>, element: Element) => {
      let map = weakMap.get(element);
      if (!map) { map = new Map(); weakMap.set(element, map); }
      return map;
    };
    const translateAttributes = (element: Element) => {
      if (element instanceof HTMLInputElement && !["button", "submit", "reset"].includes(element.type)) return;
      for (const name of watchedAttributes) {
        if (!element.hasAttribute(name)) continue;
        const current = element.getAttribute(name) ?? "";
        const sources = getAttrMap(attributeSources.current, element);
        const applied = getAttrMap(appliedAttributes.current, element);
        let source = sources.get(name);
        if (applied.has(name) && current !== applied.get(name)) {
          source = current;
          sources.set(name, current);
          applied.delete(name);
        } else if (source === undefined) {
          source = current;
          sources.set(name, current);
        }
        if (language === "en") {
          if (applied.has(name) && current === applied.get(name) && source !== current) element.setAttribute(name, source);
          applied.delete(name);
        } else {
          const translated = messages[normalized(source)];
          if (translated && translated !== current) {
            element.setAttribute(name, translated);
            applied.set(name, translated);
          }
        }
      }
    };

    const localizeTree = (root: Node) => {
      if (root instanceof Text) {
        if (!root.parentElement?.closest("script,style,pre,code,textarea")) translateText(root);
        return;
      }
      if (!(root instanceof Element || root instanceof Document)) return;
      if (root instanceof Element && root.closest("script,style,pre,code,textarea")) return;
      if (root instanceof Element) translateAttributes(root);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      let current = walker.nextNode();
      while (current) {
        if (current instanceof Text) {
          if (!current.parentElement?.closest("script,style,pre,code,textarea")) translateText(current);
        } else if (current instanceof Element) translateAttributes(current);
        current = walker.nextNode();
      }
    };

    localizeTree(document.body);
    observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "characterData" && record.target instanceof Text) localizeTree(record.target);
        else if (record.type === "attributes" && record.target instanceof Element) translateAttributes(record.target);
        else for (const node of record.addedNodes) localizeTree(node);
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: watchedAttributes });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({ language, setLanguage }), [language, setLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { language, setLanguage } = useLanguage();
  const next: Language = language === "en" ? "zh-CN" : "en";
  const label = language === "en" ? "Switch to Simplified Chinese" : "Switch to English";
  return <button type="button" className={className} aria-label={label} title={label} onClick={() => setLanguage(next)}>{language === "en" ? "中文" : "EN"}</button>;
}

export function LanguagePicker() {
  const { language, setLanguage } = useLanguage();
  return <div className="language-choice" role="group" aria-label={language === "zh-CN" ? "语言" : "Language"}>
    <button type="button" className={language === "en" ? "selected" : ""} aria-pressed={language === "en"} onClick={() => setLanguage("en")}>English</button>
    <button type="button" className={language === "zh-CN" ? "selected" : ""} aria-pressed={language === "zh-CN"} onClick={() => setLanguage("zh-CN")}>简体中文</button>
  </div>;
}
