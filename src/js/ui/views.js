import { settingsHTML } from './settings.js';
import { state } from '../state.js';
import { generatorHTML } from './generator.js';
import { importHTML } from './import.js';
import { historyHTML } from './history.js';
import { networkHTML } from './network.js';
import { photosHTML } from './photos.js';
import { friendsHTML } from './friends.js';
import { checkerHTML } from './checker.js';

export function viewHTML() {
  switch (state.view) {
    case 'settings': return settingsHTML();
    case 'generator':
      return generatorHTML();
    case 'import':
      return importHTML();
    case 'history':
      return historyHTML();
    case 'network':
      return networkHTML();
    case 'photos':
      return photosHTML();
    case 'friends':
      return friendsHTML();
    case 'checker':
      return checkerHTML();
    default:
      return generatorHTML();
  }
}
