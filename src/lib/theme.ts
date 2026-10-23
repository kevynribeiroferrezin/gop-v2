// Executado antes do primeiro paint. Conteudo fixo; recebe nonce pelo layout.
export const themeBootstrap = `(()=>{let t;try{t=localStorage.getItem('theme')}catch{}if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.classList.toggle('dark',t==='dark');document.documentElement.style.colorScheme=t})()`;
