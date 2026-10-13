import ProductRating from "@/app/ui/product-rating";
import "./rate.css";

const TRUSTPILOT_URL = "https://www.trustpilot.com/review/tidelight.app";
const GOOGLE_REVIEW_URL = "https://g.page/r/CR1HF6_vRb5HECE/review";

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
        <div className="trustpilot-review-mark" aria-hidden="true">G</div>
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
