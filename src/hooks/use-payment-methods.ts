import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DEFAULT_PAYMENT_METHODS,
  pullPaymentMethods,
  savePaymentMethods,
} from "@/settings";
import type { PaymentMethodOption } from "@/models/types";

export const paymentMethodsKey = ["payment-methods"] as const;

/** The salon's configurable payment methods. */
export function usePaymentMethods(): PaymentMethodOption[] {
  const { data } = useQuery({
    queryKey: paymentMethodsKey,
    queryFn: pullPaymentMethods,
    placeholderData: DEFAULT_PAYMENT_METHODS,
  });
  return data ?? DEFAULT_PAYMENT_METHODS;
}

export function useUpdatePaymentMethods() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (methods: PaymentMethodOption[]) => savePaymentMethods(methods),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: paymentMethodsKey });
    },
  });
}
