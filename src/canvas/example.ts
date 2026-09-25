import { useBoard } from '../store/board';
import { toStoredImage } from './images';

/** A simple drawn skyline, so the example works without any downloads. */
const CITY = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1b5c"/><stop offset=".6" stop-color="#b44d9a"/><stop offset="1" stop-color="#f4a36c"/></linearGradient></defs>
<rect width="400" height="300" fill="url(#s)"/>
<circle cx="300" cy="80" r="34" fill="#ffe3b3" opacity=".8"/>
<g fill="#1d1640"><rect x="20" y="120" width="44" height="180"/><rect x="72" y="70" width="34" height="230"/><rect x="114" y="140" width="52" height="160"/><rect x="176" y="40" width="30" height="260"/><rect x="214" y="110" width="58" height="190"/><rect x="282" y="150" width="40" height="150"/><rect x="330" y="95" width="50" height="205"/></g>
<g fill="#5ff0e8"><rect x="80" y="90" width="6" height="6"/><rect x="92" y="120" width="6" height="6"/><rect x="184" y="70" width="6" height="6"/><rect x="190" y="130" width="6" height="6"/><rect x="226" y="140" width="6" height="6"/><rect x="250" y="170" width="6" height="6"/><rect x="342" y="120" width="6" height="6"/><rect x="360" y="160" width="6" height="6"/><rect x="30" y="150" width="6" height="6"/></g>
<g fill="#ffd36e"><ellipse cx="140" cy="100" rx="12" ry="3"/><ellipse cx="260" cy="70" rx="10" ry="3"/><ellipse cx="60" cy="60" rx="8" ry="2"/></g>
<rect y="285" width="400" height="15" fill="#120d2b"/>
</svg>`;

export async function placeExample(center: { x: number; y: number }) {
  const { addCard } = useBoard.getState();
  const { image } = await toStoredImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(CITY)}`);
  addCard('idea', { x: center.x - 260, y: center.y - 90 }, { text: 'A hero explores a futuristic city' });
  addCard('picture', { x: center.x + 110, y: center.y - 70 }, { image, text: 'Tall glowing towers and flying lights at sunset', h: 260 });
  addCard('style', { x: center.x + 200, y: center.y + 250 }, { title: 'Storybook', text: 'Bright, friendly storybook illustration' });
  addCard('note', { x: center.x - 330, y: center.y + 170 }, {
    title: 'Try this',
    text: '1. Drag the dot on the right of the idea onto the picture.\n2. Connect the idea to the style too.\n3. Click the idea, then press “Make a picture”.',
    w: 260,
    h: 190,
  });
  useBoard.getState().select(null);
}
