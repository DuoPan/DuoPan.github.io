const renderContact = ({ t }) => {
  const wrapperElem = document.getElementById("wrapper");
  const dataElem = document.createElement("div");
  dataElem.classList.add("remove");
  dataElem.classList.add("contact-grid");

  dataElem.innerHTML = `
    <div class="contact-card">
      <div class="contact-title">${t("contact.title")}</div>
      <div class="contact-text">${t("contact.about")}</div>
    </div>
    <div class="contact-card">
      <div class="contact-title">${t("contact.reach")}</div>
      <div class="contact-item">
        <span class="contact-label">${t("contact.email")}</span>
        <span class="contact-value">tonyagenting@gmail.com</span>
      </div>
    </div>
    <div class="contact-card contact-wide">
      <div class="contact-title">${t("donate.title")}</div>
      <div class="contact-text">${t("donate.desc")}</div>
      <div class="donate-grid">
        <div class="qr-card">
          <div class="qr-label">${t("donate.paypal")}</div>
          <img src="paypal_QR_code.png" alt="PayPal QR" class="qr-image"
            onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
          <div class="qr-placeholder">${t("donate.placeholder")}</div>
        </div>
        <div class="donate-actions">
          <div class="donate-note">${t("donate.linkDesc")}</div>
          <a class="donate-link" href="https://www.paypal.com/donate/?business=7YUMV5D8UREFC&no_recurring=0&item_name=All+donations+will+be+used+for+website+maintenance.&currency_code=AUD" target="_blank" rel="noopener noreferrer">
            ${t("donate.linkCta")}
          </a>
          <button class="benefits-btn" id="benefitsBtn">${t("donate.benefitsCta")}</button>
        </div>
      </div>
    </div>
    <div class="benefits-overlay" id="benefitsOverlay" aria-hidden="true">
      <div class="benefits-modal" role="dialog" aria-modal="true" aria-labelledby="benefitsTitle">
        <div class="benefits-head">
          <div class="benefits-title" id="benefitsTitle">${t("donate.benefitsTitle")}</div>
          <button class="benefits-close" id="benefitsClose" aria-label="${t("donate.close")}">×</button>
        </div>
        <ul class="benefits-list">
          <li>${t("donate.benefit1")}</li>
          <li>${t("donate.benefit2")}</li>
          <li>${t("donate.benefit3")}</li>
        </ul>
      </div>
    </div>
  `;

  wrapperElem.appendChild(dataElem);

  const overlay = document.getElementById("benefitsOverlay");
  const openBtn = document.getElementById("benefitsBtn");
  const closeBtn = document.getElementById("benefitsClose");
  if (overlay && openBtn && closeBtn) {
    const open = () => {
      overlay.setAttribute("aria-hidden", "false");
      overlay.classList.add("is-open");
    };
    const close = () => {
      overlay.setAttribute("aria-hidden", "true");
      overlay.classList.remove("is-open");
    };
    openBtn.addEventListener("click", open);
    closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
  }
};

export default renderContact;
