/* Catálogo de estilos. Cada tema define:
 *  - ui:        cores da própria interface do launcher
 *  - wallpaper: especificação do gerador procedural (ver wallpapers.js)
 *  - windows:   cores do Windows (modo escuro, destaque, transparência...)
 *  - taskbar:   configuração da barra de tarefas
 */
(function () {
  'use strict';

  const CATEGORIES = [
    { id: 'all', label: 'Todos' },
    { id: 'gamer', label: 'Gamer' },
    { id: 'tech', label: 'Tecnológico' },
    { id: 'minimal', label: 'Minimalista' },
    { id: 'anime', label: 'Anime' },
    { id: 'retro', label: 'Retrô' },
    { id: 'space', label: 'Espaço' },
    { id: 'custom', label: 'Meus temas' },
  ];

  const darkTaskbar = { align: 'center', autoHide: false, search: 'icon', taskView: false, widgets: false };

  const THEMES = [
    // ---------------- GAMER ----------------
    {
      id: 'rgb-overdrive',
      name: 'RGB Overdrive',
      category: 'gamer',
      tagline: 'Neon vermelho e roxo, grade de arena e emblema afiado.',
      ui: { bg: '#08060d', surface: '#141020', accent: '#ff1f4b', accent2: '#8b5cf6', text: '#f6f3ff', muted: '#9c94b8' },
      wallpaper: { type: 'angular', seed: 7, bg: ['#050308', '#120818', '#07040b'], neon: ['#ff1f4b', '#8b5cf6', '#ff8a00'] },
      windows: { darkMode: true, accent: '#ff1f4b', transparency: true, accentOnTaskbar: true, accentOnTitleBars: true },
      taskbar: { ...darkTaskbar },
    },
    {
      id: 'toxic-arena',
      name: 'Toxic Arena',
      category: 'gamer',
      tagline: 'Verde tóxico sobre preto, estilo setup competitivo.',
      ui: { bg: '#050805', surface: '#0f1610', accent: '#39ff14', accent2: '#00e5ff', text: '#effff0', muted: '#8fae92' },
      wallpaper: { type: 'angular', seed: 21, bg: ['#020402', '#08140a', '#020402'], neon: ['#39ff14', '#00e5ff', '#d4ff00'] },
      windows: { darkMode: true, accent: '#2bd40f', transparency: true, accentOnTaskbar: true, accentOnTitleBars: false },
      taskbar: { ...darkTaskbar, align: 'left' },
    },
    {
      id: 'night-city',
      name: 'Night City',
      category: 'gamer',
      tagline: 'Metrópole cyberpunk sob chuva, letreiros magenta e ciano.',
      ui: { bg: '#090514', surface: '#160d26', accent: '#ff2bd6', accent2: '#00f0ff', text: '#fdf2ff', muted: '#a690bf' },
      wallpaper: {
        type: 'city', seed: 42, rain: true, stars: false,
        sky: ['#06020f', '#1d0838', '#4a0f5c', '#ff2bd6'],
        buildings: ['#1a0d33', '#120826', '#07030f'],
        neon: ['#ff2bd6', '#00f0ff', '#fff200'],
        windows: ['#00f0ff', '#ff2bd6', '#ffd36b'],
      },
      windows: { darkMode: true, accent: '#ff2bd6', transparency: true, accentOnTaskbar: true, accentOnTitleBars: true },
      taskbar: { ...darkTaskbar },
    },

    // ---------------- TECNOLÓGICO ----------------
    {
      id: 'circuit-core',
      name: 'Circuit Core',
      category: 'tech',
      tagline: 'Processador central com trilhas de circuito azul elétrico.',
      ui: { bg: '#030a14', surface: '#0a1626', accent: '#00b3ff', accent2: '#00ffd5', text: '#e8f6ff', muted: '#7f9bb5' },
      wallpaper: { type: 'circuit', seed: 3, bg: ['#06162b', '#01050c'], line: '#1e90ff', glow: '#00e1ff' },
      windows: { darkMode: true, accent: '#0091ea', transparency: true, accentOnTaskbar: true, accentOnTitleBars: true },
      taskbar: { ...darkTaskbar, search: 'box', taskView: true },
    },
    {
      id: 'code-rain',
      name: 'Code Rain',
      category: 'tech',
      tagline: 'Terminal hacker com chuva de caracteres verdes.',
      ui: { bg: '#010601', surface: '#071207', accent: '#00ff66', accent2: '#a3ff12', text: '#dcffe6', muted: '#6f9c7a' },
      wallpaper: { type: 'code', seed: 99, bg: ['#000300', '#001a06'], color: '#00ff66', head: '#d9ffe6' },
      windows: { darkMode: true, accent: '#00c853', transparency: false, accentOnTaskbar: true, accentOnTitleBars: false },
      taskbar: { ...darkTaskbar, align: 'left', search: 'hidden' },
    },
    {
      id: 'data-flow',
      name: 'Data Flow',
      category: 'tech',
      tagline: 'Fita de dados fluindo em degradê ciano-violeta.',
      ui: { bg: '#05040f', surface: '#100e22', accent: '#6d5dfc', accent2: '#00d4ff', text: '#eeedff', muted: '#8d8ab5' },
      wallpaper: { type: 'waves', seed: 12, bg: ['#03020a', '#0b0a24', '#03020a'], ribbon: ['#00d4ff', '#6d5dfc', '#ff3dcb'] },
      windows: { darkMode: true, accent: '#6d5dfc', transparency: true, accentOnTaskbar: false, accentOnTitleBars: false },
      taskbar: { ...darkTaskbar },
    },

    // ---------------- MINIMALISTA ----------------
    {
      id: 'paper-light',
      name: 'Paper Light',
      category: 'minimal',
      tagline: 'Claro, calmo e limpo. Tons de areia e terracota.',
      ui: { bg: '#f4efe8', surface: '#ffffff', accent: '#c8643b', accent2: '#3d5a80', text: '#2b2622', muted: '#8a8178', light: true },
      wallpaper: { type: 'shapes', seed: 5, bg: ['#f6f1ea', '#ece4d8'], sun: '#e07a52', line: '#3d3a36', hills: ['#d9c9b4', '#c9b59c', '#b39d82'], lightGrain: false },
      windows: { darkMode: false, accent: '#c8643b', transparency: true, accentOnTaskbar: false, accentOnTitleBars: false },
      taskbar: { align: 'center', autoHide: false, search: 'hidden', taskView: false, widgets: false },
    },
    {
      id: 'mono-dark',
      name: 'Mono Dark',
      category: 'minimal',
      tagline: 'Grafite e branco, sem distrações. Barra oculta automaticamente.',
      ui: { bg: '#0e0f11', surface: '#18191c', accent: '#e8e8e8', accent2: '#8a8f98', text: '#f1f1f1', muted: '#80848c' },
      wallpaper: { type: 'shapes', seed: 8, bg: ['#1a1b1f', '#0d0e10'], sun: '#e9e6df', line: '#9aa0a6', hills: ['#25272b', '#1c1d21', '#141518'], lightGrain: true },
      windows: { darkMode: true, accent: '#6b7280', transparency: true, accentOnTaskbar: false, accentOnTitleBars: false },
      taskbar: { align: 'center', autoHide: true, search: 'hidden', taskView: false, widgets: false },
    },
    {
      id: 'nordic-calm',
      name: 'Nordic Calm',
      category: 'minimal',
      tagline: 'Ondas suaves em azul-gelo inspiradas em fiordes.',
      ui: { bg: '#1f2530', surface: '#2a313d', accent: '#88c0d0', accent2: '#b48ead', text: '#eceff4', muted: '#97a3b6' },
      wallpaper: { type: 'waves', seed: 31, bg: ['#2e3440', '#3b4252', '#4c566a'], layers: ['#5e81ac', '#4f6f96', '#3f5a7d', '#2e4460', '#1f2f45'], softShadow: true, lightGrain: true },
      windows: { darkMode: true, accent: '#5e81ac', transparency: true, accentOnTaskbar: false, accentOnTitleBars: true },
      taskbar: { align: 'left', autoHide: false, search: 'icon', taskView: true, widgets: false },
    },

    // ---------------- ANIME ----------------
    {
      id: 'sakura-sunset',
      name: 'Sakura Sunset',
      category: 'anime',
      tagline: 'Pôr do sol pastel, monte nevado, lago e flores de cerejeira.',
      ui: { bg: '#1c1229', surface: '#2a1b3b', accent: '#ff8fb8', accent2: '#ffc38a', text: '#fff4f8', muted: '#c3a7c9' },
      wallpaper: {
        type: 'sakura', seed: 17,
        sky: ['#2b2a63', '#6b4fa3', '#e48bb6', '#ffc8a2'],
        sun: '#fff1c9', cloud: '#ffe3ef', snow: '#fdf4ff',
        mountain: ['#7c6bb3', '#3e3270'], hills: ['#4a3a7a', '#33285c'],
        water: ['#7f5fa8', '#2b2152'], branch: '#3a1f2b', petal: ['#ffb7d0', '#ff8fb8', '#ffd6e5'],
      },
      windows: { darkMode: true, accent: '#ff7eb0', transparency: true, accentOnTaskbar: true, accentOnTitleBars: true },
      taskbar: { ...darkTaskbar },
    },
    {
      id: 'lofi-night',
      name: 'Lo-fi Night',
      category: 'anime',
      tagline: 'Noite estrelada de anime, lua cheia e cidade adormecida.',
      ui: { bg: '#0b0d22', surface: '#151837', accent: '#7aa2ff', accent2: '#ffd36b', text: '#eef1ff', muted: '#959bc6' },
      wallpaper: {
        type: 'city', seed: 58, rain: false, stars: true, shootingStars: true, moon: '#fff4d6',
        sky: ['#05061a', '#151a4a', '#3a3f86', '#7a6fb8'],
        buildings: ['#22265a', '#161942', '#0b0c24'],
        neon: ['#7aa2ff', '#ffd36b'],
        windows: ['#ffd36b', '#ffe9a8', '#ffb86b'],
      },
      windows: { darkMode: true, accent: '#5b7cfa', transparency: true, accentOnTaskbar: true, accentOnTitleBars: false },
      taskbar: { ...darkTaskbar, align: 'center' },
    },

    // ---------------- RETRÔ ----------------
    {
      id: 'synthwave-84',
      name: 'Synthwave 84',
      category: 'retro',
      tagline: 'Sol listrado, montanhas wireframe e grade infinita.',
      ui: { bg: '#0d0221', surface: '#1b0a3a', accent: '#ff2a6d', accent2: '#05d9e8', text: '#fdf0ff', muted: '#b190c9' },
      wallpaper: {
        type: 'synthwave', seed: 84,
        sky: ['#0d0221', '#261447', '#6a1b6d', '#ff2a6d'],
        sun: ['#ffd319', '#ff2a6d', '#c0167f'],
        mountain: ['#2a0f4f', '#140629'], ground: '#0d0221', grid: '#05d9e8',
      },
      windows: { darkMode: true, accent: '#ff2a6d', transparency: true, accentOnTaskbar: true, accentOnTitleBars: true },
      taskbar: { ...darkTaskbar },
    },
    {
      id: 'pixel-dusk',
      name: 'Pixel Dusk',
      category: 'retro',
      tagline: 'Paisagem 8-bit ao entardecer com pinheiros e lago.',
      ui: { bg: '#140c1c', surface: '#22162f', accent: '#ffaa5e', accent2: '#5fcde4', text: '#fff1e0', muted: '#b59cae' },
      wallpaper: {
        type: 'pixel', seed: 8,
        sky: ['#1a1c2c', '#29366f', '#3b5dc9', '#7a5ba8', '#b55088', '#ef7d57', '#ffcd75'],
        moon: '#fff4c2', layers: ['#5d275d', '#3b1f4a', '#25162f'], trees: '#120a18', water: '#1f2a52',
      },
      windows: { darkMode: true, accent: '#ef7d57', transparency: false, accentOnTaskbar: true, accentOnTitleBars: false },
      taskbar: { ...darkTaskbar, align: 'left' },
    },

    // ---------------- ESPAÇO ----------------
    {
      id: 'deep-nebula',
      name: 'Deep Nebula',
      category: 'space',
      tagline: 'Nebulosa violeta, milhares de estrelas e planeta anelado.',
      ui: { bg: '#04030a', surface: '#110d1f', accent: '#b26bff', accent2: '#ff7ac6', text: '#f3edff', muted: '#998fb8' },
      wallpaper: { type: 'nebula', seed: 64, bg: '#020108', colors: ['#7b2ff7', '#f107a3', '#2d6bff', '#00c2ff'], planet: ['#ffcf9e', '#c0577a', '#ffd9b8'] },
      windows: { darkMode: true, accent: '#9b51e0', transparency: true, accentOnTaskbar: true, accentOnTitleBars: true },
      taskbar: { ...darkTaskbar },
    },
  ];

  window.ThemeCatalog = { CATEGORIES, THEMES };
})();
