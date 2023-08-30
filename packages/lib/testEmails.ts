declare global {
  // eslint-disable-next-line no-var
  var testEmails: Record<
    string,
    {
      to: string;
      from: string;
      subject: string;
    }
  >[];
}

export const setTestEmail = (email: (typeof globalThis.testEmails)[number]) => {
  globalThis.testEmails = globalThis.testEmails || [];
  globalThis.testEmails.push(email);
};

export const getTestEmails = () => {
  return globalThis.testEmails;
};
