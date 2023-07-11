import {enrichFetch} from './';
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

    return enrichFetch({url: endpoint, params: bodyParams});
  };

  return send;
};

export default initSend;
