import mitt from 'mitt';

type Events = {
  passwordChange: string | null;
};

const emitter = mitt<Events>();

let password: null | string = null;

export const onPasswordChange = (handler: (newPassword: string | null) => void) => emitter.on('passwordChange', handler);
export const setPassword = (newPassword: string | null) => {
  password = newPassword;
  emitter.emit('passwordChange', password);
};
export const getPassword = () => password;
