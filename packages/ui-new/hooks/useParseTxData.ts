import { iface1155PresetMinterPauser, iface721PresetMinterPauserAutoId, iface20PresetMinterPauser } from '@core/contracts';
import { useCallback, useEffect, useState } from 'react';

import { from, catchError } from 'rxjs';

const try721 = async (data: string) => {
  const result = iface721PresetMinterPauserAutoId.parseTransaction({ data: data });
  console.log(result, '721');
  return result.name;
};

const try11155 = async (data: string) => {
  const result = iface1155PresetMinterPauser.parseTransaction({ data: data });
  console.log(result.name, '1155');
  return result.name;
};
const try20 = async (data: string) => {
  const result = iface20PresetMinterPauser.parseTransaction({ data: data });
  return result.name;
};

export type ParseTxDataParameters = {
  to?: string;
  data?: string;
};

type methodName = string;
type ParseResult =
  | {
      isPadding: true;
      isSuccess: false;
      error: null;
      methodName: null;
    }
  | {
      isSuccess: true;
      isPadding: false;
      error: null;
      methodName: methodName;
    }
  | {
      isSuccess: false;
      isPadding: false;
      error: string;
      methodName: null;
    };

export const useParseTxData = ({ to, data }: ParseTxDataParameters) => {
  const [result, setResult] = useState<ParseResult>({ isPadding: true, isSuccess: false, error: null, methodName: null });

  useEffect(() => {
    // is not tx recipient Address , return the method is contract create
    if (!to) {
      setResult({
        isPadding: false,
        isSuccess: true,
        error: null,
        methodName: 'Contract Create',
      });
      return;
    }

    if (!data) {
      setResult({
        isPadding: false,
        isSuccess: true,
        error: null,
        methodName: 'unknown',
      });

      return;
    }
    const sub = from(try11155(data))
      .pipe(
        catchError((err) => {
          return from(try721(data));
        }),
        catchError((err) => {
          return from(try20(data));
        }),
      )
      .subscribe({
        next: (name) => {
          setResult({
            isPadding: false,
            isSuccess: true,
            error: null,
            methodName: name,
          });
        },
        error: (err) => {
          setResult({
            isPadding: false,
            isSuccess: true,
            error: null,
            methodName: 'unknown',
          });
        },
      });

    return () => {
      sub.unsubscribe();
    };
  }, [to, data]);

  return {
    ...result,
  };
};
