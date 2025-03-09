function filterMomos() {
    let input = document.getElementById("search").value.toLowerCase();
    let menuItems = document.querySelectorAll(".menu-item");
    menuItems.forEach(item => {
        let name = item.getAttribute("data-name");
        item.style.display = name.includes(input) ? "block" : "none";
    });
}

function toggleMenu() {
    document.body.classList.toggle("menu-open");
}