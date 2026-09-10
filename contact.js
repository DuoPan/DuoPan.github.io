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
          <details class="support-notes"><summary>${t("donate.benefitsCta")}</summary><ul>
            <li>${t("donate.benefit1")}</li><li>${t("donate.benefit2")}</li><li>${t("donate.benefit3")}</li>
          </ul></details>
        </div>
      </div>
    </div>
  `;

  wrapperElem.appendChild(dataElem);

};

export default renderContact;
