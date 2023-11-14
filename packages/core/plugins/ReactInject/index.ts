import { atom, useAtomValue } from 'jotai';
import { type Plugin } from '../../plugins/Plugin';


class ReactInjectPlugin implements Plugin {
  public name = 'ReactInject';
}

export default ReactInjectPlugin;
export * from './nexus'
