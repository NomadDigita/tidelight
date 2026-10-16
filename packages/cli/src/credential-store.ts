import { Entry } from "@napi-rs/keyring";

const SERVICE = "app.tidelight.cli";
const ACCOUNT = "project-api-key";

export interface CredentialStore {
  get(): string | null;
  set(value: string): void;
  delete(): void;
}

/** Uses the OS credential store. Linux requires Secret Service (for example GNOME Keyring or KWallet). */
export class OsCredentialStore implements CredentialStore {
  private entry() {
    return new Entry(SERVICE, ACCOUNT, { linux: { store: "secret-service" } });
  }

  get() {
    try { return this.entry().getPassword(); }
    catch { throw new Error("The operating-system credential store is unavailable. Unlock a supported keychain or set TIDELIGHT_API_KEY for this process."); }
  }

  set(value: string) {
    try { this.entry().setPassword(value); }
    catch { throw new Error("Could not save the credential to the operating-system keychain. Set TIDELIGHT_API_KEY for this process instead."); }
  }

  delete() {
    try { this.entry().deletePassword(); }
    catch { throw new Error("Could not remove the credential from the operating-system keychain."); }
  }
}
