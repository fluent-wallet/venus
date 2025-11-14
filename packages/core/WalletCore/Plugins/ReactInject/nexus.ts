import { createStore } from 'jotai';

export const store = createStore();

export const setAtom = store.set;

export const getAtom = store.get;
