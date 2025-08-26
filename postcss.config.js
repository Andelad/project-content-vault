import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import tailwindcssNesting from 'tailwindcss/nesting/index.js'

export default {
  // Ensure nesting is enabled BEFORE Tailwind, per Tailwind docs
  plugins: [
  tailwindcssNesting,
  tailwindcss(),
  autoprefixer(),
  ],
}
