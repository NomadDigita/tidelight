import ProductRating from "@/app/ui/product-rating";
import "./rate.css";

const TRUSTPILOT_URL = "https://www.trustpilot.com/review/tidelight.app";
const GOOGLE_REVIEW_URL = "https://g.page/r/CR1HF6_vRb5HECE/review";

function GoogleMark() {
  return <svg viewBox="0 0 48 48" role="img" aria-label="Google" className="google-brand-mark"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.2H5.8a20 20 0 0 0 0 17.6l6.8-5.2Z"/><path fill="#EA4335" d="M24 12c3 0 5.6 1 7.7 3.1l5.8-5.8C34 5.9 29.5 4 24 4A20 20 0 0 0 5.8 15.2l6.8 5.2C14.2 15.6 18.7 12 24 12Z"/></svg>;
}

export default function RatePage() {
  return (
    <main className="content-wrap inner-page account-info-page">
      <div className="account-info-hero">
        <span className="eyebrow">YOUR VOICE SHAPES THE DESK</span>
        <h1>Share your Tidelight experience.</h1>
        <p>Help other people discover Tidelight. Leave an honest public review on Google or Trustpilot, or send private feedback directly to our team.</p>
      </div>

      <section className="trustpilot-review-card" aria-labelledby="trustpilot-heading">
        <div className="trustpilot-review-mark" aria-hidden="true">★</div>
        <div className="trustpilot-review-copy">
          <span className="eyebrow">PUBLIC REVIEW · TRUSTPILOT</span>
          <h2 id="trustpilot-heading">Tell the world what you think</h2>
          <p>Your review will appear on Tidelight’s Trustpilot profile. Please share your genuine experience, whether it was positive or critical.</p>
        </div>
        <a className="trustpilot-review-button" href={TRUSTPILOT_URL} target="_blank" rel="noopener noreferrer">
          Write a Trustpilot review <span aria-hidden="true">↗</span>
        </a>
        <a className="trustpilot-review-secondary" href={TRUSTPILOT_URL} target="_blank" rel="noopener noreferrer">View Tidelight’s Trustpilot profile</a>
      </section>

      <section className="trustpilot-review-card google-review-card" aria-labelledby="google-review-heading">
        <div className="trustpilot-review-mark google-review-mark"><GoogleMark /></div>
        <div className="trustpilot-review-copy">
          <span className="eyebrow">PUBLIC REVIEW · GOOGLE</span>
          <h2 id="google-review-heading">Share a Google review</h2>
          <p>Tell people about your genuine experience with Tidelight. Your review will appear on our Google profile.</p>
        </div>
        <a className="trustpilot-review-button" href={GOOGLE_REVIEW_URL} target="_blank" rel="noopener noreferrer">
          Write a Google review <span aria-hidden="true">↗</span>
        </a>
      </section>

      <section className="rating-panel" aria-labelledby="private-feedback-heading">
        <div className="rating-panel-intro">
          <span className="rating-orbit" aria-hidden="true">✦</span>
          <div>
            <span className="eyebrow">PRIVATE · SENT TO OUR TEAM</span>
            <h2 id="private-feedback-heading">Rate your experience privately</h2>
            <p>This rating and any comment are sent to Tidelight’s feedback inbox. They are not published.</p>
          </div>
        </div>
        <ProductRating />
      </section>

    </main>
  );
}
