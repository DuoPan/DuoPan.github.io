export const removeData = () => {
    document.querySelectorAll(".remove").forEach(el => el.remove());
};

export const highlightBtn = (id) => {
    const menuBtns = document.getElementsByClassName("menuBtn");
    for (const btn of menuBtns) {
        btn.classList.toggle("is-active", btn.id === id);
    }
};

export const setActiveMenu = (viewKey) => {
    const menuBtns = document.getElementsByClassName("menuBtn");
    for (const btn of menuBtns) {
        btn.classList.toggle("is-active", btn.dataset.view === viewKey);
    }
};
