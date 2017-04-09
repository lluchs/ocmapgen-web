const Router = require('koa-better-router')
const router = Router({prefix: '/api'}).loadMethods()

const {MapGen} = require('ocmapgen-client')

const opts = {
  root: process.env.OPENCLONK_PLANET || './openclonk',
  timeout: +process.env.TIMEOUT || 1000,
}

let ocmapgenCmd = process.env.OCMAPGEN
if (ocmapgenCmd)
  opts.cmd = ocmapgenCmd

const mapgenMapC = new MapGen(Object.assign({}, opts, {
  map_type: 'Map.c'
}))

const mapgenLandscapeTxt = new MapGen(Object.assign({}, opts, {
  map_type: 'Landscape.txt'
}))

const handleMapGen = (mapgen) => async (ctx, next) => {
  try {
    let {fg} = await mapgen.generate(ctx.request.rawBody)
    ctx.body = fg
    ctx.status = 200
    ctx.set('Content-Type', 'image/png')
  } catch (e) {
    ctx.body = e.message.toString()
    ctx.status = 400
  }
  return next()
}

router.post('/Map.c', handleMapGen(mapgenMapC))
router.post('/Landscape.txt', handleMapGen(mapgenLandscapeTxt))

// The server
const Koa = require('koa') // Koa v2
const app = new Koa()

app.use(require('koa-static')(__dirname+'/static'))
app.use(require('koa-bodyparser')({
  enableTypes: ['text'],
}))
app.use(router.middleware())

let port = +process.env.PORT || 11110
app.listen(port, () => {
  console.log(`Listening on port ${port}`)
})
