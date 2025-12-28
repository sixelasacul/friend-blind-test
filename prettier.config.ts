import { type Config } from 'prettier'
import oxfmtConfig from './.oxfmtrc.json' with { type: 'json' }

const config: Config = {
  // this is not yet supported by oxfmt, though having this plugin here requires
  // to run prettier entirely after oxfmt, and it takes 1.5s, compared to 0.2s.
  plugins: ['prettier-plugin-tailwindcss'],
  ...(oxfmtConfig as Config)
}

export default config
