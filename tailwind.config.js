/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/**/*.html", "./public/**/*.js"],
  theme: {
    extend: {},
  },
// TAMBAHKAN BAGIAN INI
  plugins: [
    require('@tailwindcss/aspect-ratio'),
  ],
}

