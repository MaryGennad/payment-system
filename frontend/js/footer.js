// Управление футером в зависимости от авторизации
document.addEventListener('DOMContentLoaded', () => {
  const authData = window.auth?.getAuth() || {};
  const token = authData.token;
  
  const myCardsLink = document.getElementById('footerMyCards');
  const authLink = document.getElementById('footerAuth');
  
  if (myCardsLink && authLink) {
    if (token) {
      // Пользователь авторизован
      myCardsLink.style.display = 'inline';
      authLink.textContent = 'Выйти';
      authLink.onclick = (e) => {
        e.preventDefault();
        window.logout();
      };
    } else {
      // Пользователь не авторизован
      myCardsLink.style.display = 'none';
      authLink.textContent = 'Войти';
      authLink.onclick = null;
    }
  }
});