function filterMomos() {
  let input = document.getElementById("search").value.toLowerCase();
  let menuItems = document.querySelectorAll(".menu-item");
  menuItems.forEach((item) => {
    let name = item.getAttribute("data-name");
    item.style.display = name.includes(input) ? "block" : "none";
  });
}

function toggleMenu() {
  document.body.classList.toggle("menu-open");
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("form");
  const passwordInput = form.querySelector(
    '.register-form input[name="password"]'
  );

  form.addEventListener("submit", function (e) {
    const password = passwordInput.value;
    const strongPasswordRegex =
      /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_]).{8,}$/;

    if (!strongPasswordRegex.test(password)) {
      e.preventDefault();
      toastr.error(
        "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character."
      );
    }
  });
});
