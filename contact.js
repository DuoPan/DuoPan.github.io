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
      <div class="qr-grid">
        <div class="qr-card">
          <div class="qr-label">${t("donate.wechat")}</div>
          <img src="assets/wechat-qr.png" alt="WeChat QR" class="qr-image"
            onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
          <div class="qr-placeholder">${t("donate.placeholder")}</div>
        </div>
        <div class="qr-card">
          <div class="qr-label">${t("donate.alipay")}</div>
          <img src="assets/alipay-qr.png" alt="Alipay QR" class="qr-image"
            onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
          <div class="qr-placeholder">${t("donate.placeholder")}</div>
        </div>
        <div class="qr-card">
          <div class="qr-label">${t("donate.paypal")}</div>
          <img src="assets/paypal-qr.png" alt="PayPal QR" class="qr-image"
            onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
          <div class="qr-placeholder">${t("donate.placeholder")}</div>
        </div>
      </div>
    </div>
  `;

  wrapperElem.appendChild(dataElem);
};

export default renderContact;
