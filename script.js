// Hamburger menu toggle
const hamburger = document.getElementById('hamburger');
const sideMenu = document.getElementById('side-menu');

hamburger.addEventListener('click', () => {
  sideMenu.classList.toggle('hidden');
});

// Lazy load images
document.addEventListener("DOMContentLoaded", () => {
  const images = document.querySelectorAll("img[data-src]");
  images.forEach(img => {
    const realSrc = img.getAttribute("data-src");
    const tempImg = new Image();
    tempImg.src = realSrc;
    tempImg.onload = () => {
      img.src = realSrc;
    };
  });
});

// Search functionality
const searchBtn = document.getElementById('search-btn');
const searchInput = document.getElementById('search');

searchBtn.addEventListener('click', () => {
  const query = searchInput.value.trim();
  if (query) {
    window.location.href = `/search?title=${encodeURIComponent(query)}`;
  }
});

// Example Supabase connection (replace with your keys)
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = "https://your-project.supabase.co";
const supabaseKey = "public-anon-key";
const supabase = createClient(supabaseUrl, supabaseKey);

// Example: fetch username
async function getUser() {
  const { data } = await supabase.auth.getUser();
  if (data?.user) {
    document.getElementById("username").textContent = data.user.email;
  }
}
getUser();
