export const removeData = () => {
    document.querySelectorAll(".remove").forEach(el => el.remove());
};

export const highlightBtn = (id) => {
    const menuBtns = document.getElementsByClassName("menuBtn");
    // menuBtns.forEach(btn => btn.style.backgroundColor = 'red');
    for (const btn of menuBtns) {
        btn.style.backgroundColor = btn.id === id ? '#00ea4e' : '';
    }
};
