# Ulising Launcher

Launcher de desktop gamer para **Windows 10/11** que muda o visual do sistema inteiro em um clique:

- **Papel de parede**: gerado na hora, na resolução exata do seu monitor (ou use uma imagem sua)
- **Cores do Windows**: modo escuro/claro, cor de destaque, transparência e cor nas barras de título
- **Barra de tarefas**: cor de destaque, alinhamento (centro/esquerda), ocultar automaticamente, pesquisa (oculta/ícone/caixa), Visão de Tarefas e Widgets
- **Biblioteca de jogos**: adicione `.exe`, atalhos ou links (`steam://`, Epic, Battle.net, Riot…) e jogue direto do launcher

## Estilos incluídos

| Categoria | Temas |
|---|---|
| 🎮 Gamer | RGB Overdrive · Toxic Arena · Night City |
| 💻 Tecnológico | Circuit Core · Code Rain · Data Flow |
| ⚪ Minimalista | Paper Light · Mono Dark · Nordic Calm |
| 🌸 Anime | Sakura Sunset · Lo-fi Night |
| 🕹️ Retrô | Synthwave 84 · Pixel Dusk |
| 🚀 Espaço | Deep Nebula |

Todos os papéis de parede são **procedurais**: o botão *Nova variação* gera uma versão diferente do mesmo estilo. Em **Personalizar** você troca a cor de destaque, as opções da barra e salva o resultado em **Meus temas**.

## Como rodar

Requisitos: [Node.js](https://nodejs.org) 18 ou superior.

```bash
npm install
```

```bash
npm start
```

Se aparecer `Electron failed to install correctly`, o download do Electron não terminou. Rode:

```bash
node node_modules/electron/install.js
```

e depois `npm start` de novo.

### Gerar o instalador `.exe`

```bash
npm run dist
```

O instalador e a versão portátil ficam na pasta `dist/`.

## Segurança e restauração

- Tudo é alterado **apenas no seu usuário** (`HKCU`): não precisa de administrador.
- Antes de aplicar o primeiro tema, o launcher faz um **backup automático** do seu visual atual (papel de parede, cores e barra de tarefas).
- Em **Ajustes → Restaurar Windows original** você volta ao visual de antes a qualquer momento.

## Observações

- Algumas opções da barra (alinhamento, ocultar automaticamente) aparecem só depois de reiniciar o Explorer. Ative *Reiniciar o Explorer após aplicar* para ver na hora.
- No **modo claro**, o Windows não pinta a barra de tarefas com a cor de destaque (limitação do próprio sistema).
- Em versões recentes do Windows 11, a Microsoft bloqueia a alteração de *Widgets* por programas. Se isso acontecer, o launcher avisa em *Ajustes → Última aplicação* e aplica todo o resto normalmente.
- Fora do Windows o app abre normalmente para pré-visualizar e exportar papéis de parede, mas não aplica estilos.

## Estrutura

```
main.js                      processo principal do Electron (janela, IPC, arquivos)
preload.js                   ponte segura entre a interface e o sistema
scripts/windows/apply-style.ps1   motor que aplica/salva/restaura o estilo no Windows
src/index.html, styles.css   interface
src/themes.js                catálogo de estilos (adicione os seus aqui)
src/wallpapers.js            geradores procedurais de papel de parede
src/app.js                   lógica da interface
```

### Criando um novo estilo

Adicione um objeto em `src/themes.js` reaproveitando um dos geradores (`angular`, `city`, `circuit`, `code`, `waves`, `shapes`, `sakura`, `synthwave`, `pixel`, `nebula`) com as suas cores:

```js
{
  id: 'meu-estilo',
  name: 'Meu Estilo',
  category: 'gamer',
  tagline: 'Descrição curta.',
  ui: { bg: '#08060d', surface: '#141020', accent: '#00e5ff', accent2: '#ff00aa', text: '#ffffff', muted: '#9a9ab0' },
  wallpaper: { type: 'angular', seed: 1, bg: ['#000000', '#101020', '#000000'], neon: ['#00e5ff', '#ff00aa', '#ffffff'] },
  windows: { darkMode: true, accent: '#00b8d4', transparency: true, accentOnTaskbar: true, accentOnTitleBars: true },
  taskbar: { align: 'center', autoHide: false, search: 'icon', taskView: false, widgets: false },
}
```
