import base64,glob,re
css=open(glob.glob('.preview-dist/assets/*.css')[0]).read()
js=open(glob.glob('.preview-dist/assets/*.js')[0]).read()
font='data:font/woff2;base64,'+base64.b64encode(open('public/fonts/InterVariable.woff2','rb').read()).decode()
img='data:image/jpeg;base64,'+base64.b64encode(open('public/welcome/arrivals.jpg','rb').read()).decode()
# Phone-sized preview: size against the phone screen, not the browser window.
css=re.sub(r'@media\s*\((?:min-width:\s*|width\s*>=\s*)(?:900|700)px\)','@media (min-width:99999px)',css)
css=re.sub(r'(\d)dvh',r'\1cqh',css); css=re.sub(r'(\d)vh',r'\1cqh',css); css=re.sub(r'(\d)vw',r'\1cqw',css)
css=css.replace('/fonts/InterVariable.woff2',font); js=js.replace('/welcome/arrivals.jpg',img).replace('</script','<\\/script')
extra='''html,body{height:100%;margin:0;background:#fff}
.pv-note{position:fixed;left:50%;top:calc(16px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:200;width:max-content;max-width:calc(100% - 32px);padding:12px 18px;border-radius:16px;font:600 14px/1.35 var(--font);color:#fff;background:#0b0d12;box-shadow:0 12px 30px rgba(0,0,0,.25);animation:w-fade .25s ease both}'''
airports=open('public/data/airports.json').read().replace('</','<\\/')
shell=open('preview/shell.html').read().replace('__CSS__',css+extra).replace('<script type="module">__JS__</script>','<script>window.__AIRPORTS='+airports+'</script><script type="module">__JS__</script>').replace('__JS__',js)
open('.preview-dist/arigreet.html','w').write(shell)
print(len(shell))
