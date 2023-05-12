import * as babel from '@babel/core'
import * as fs from 'fs'
import { fileURLToPath } from 'url'
import plugin from './plugin/index.js'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const code = fs.readFileSync(`${__dirname}/in.js`).toString()

const transformation = babel.transform(code, {
  plugins: [plugin],
  code: true,
  ast: false,
})

if (transformation?.code) {
  fs.writeFileSync(`${__dirname}/out.js`, transformation.code)
}
