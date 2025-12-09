export type Key2PasswordValidation = {
  hasLength: boolean;
  hasLowerCase: boolean;
  hasUpperCase: boolean;
  hasNumber: boolean;
};

export const validateKey2Password = (password: string): Key2PasswordValidation => {
  return {
    hasLength: password.length >= 8,
    hasLowerCase: /[a-z]/.test(password),
    hasUpperCase: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  };
};
