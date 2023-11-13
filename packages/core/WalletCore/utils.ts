/* eslint-disable @typescript-eslint/no-empty-function */
export class Singleton {
  private static instance: Singleton;
  public static getInstance(): Singleton {
      if (!Singleton.instance) {
          Singleton.instance = new Singleton();
      }
    
      return Singleton.instance;
  }
}
