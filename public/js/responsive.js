document.addEventListener("DOMContentLoaded", function () {
    const menuIcon = document.getElementById("menu-icon");
    const menuList = document.getElementById("menulist");

    // Toggle menu visibility when clicking the icon
    menuIcon.addEventListener("click", function () {
        menuList.classList.toggle("show");
    });

    // Close menu if clicked outside
    document.addEventListener("click", function (event) {
        if (!menuIcon.contains(event.target) && !menuList.contains(event.target)) {
            menuList.classList.remove("show");
        }
    });
});
