const createRandomId = () => {
  const MAX = Number.MAX_SAFE_INTEGER;
  let idCounter = Math.round(Math.random() * MAX);
  idCounter = idCounter % MAX;
  return idCounter++;
};

const initSend = endpoint => {
  const send = (method, params) => {
    if (!method) {
      return;
    }

    const bodyParams = {
      jsonrpc: '2.0',
      id: createRandomId(),
      method,
    };

    if (params) {
      bodyParams.params = params;
    }

    return fetch(endpoint, {
      method: 'POST',
      timeout: 6000,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...bodyParams,
      }),
    })
      .then(r => r.json())
      .then(r => r.result);
  };

  return send;
};

export default initSend;
