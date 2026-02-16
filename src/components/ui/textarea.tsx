import * as React from "react"

import { cn } from "@/lib/utils"
import { handleAutoNumber } from "@/lib/textarea-autonumber"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, onKeyDown, ...props }, ref) => {
  const internalRef = React.useRef<HTMLTextAreaElement | null>(null);

  const mergedRef = React.useCallback(
    (node: HTMLTextAreaElement | null) => {
      internalRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
      }
    },
    [ref]
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const textarea = internalRef.current;
        if (textarea) {
          const result = handleAutoNumber(
            textarea.value,
            textarea.selectionStart,
            textarea.selectionEnd
          );

          if (result) {
            e.preventDefault();

            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
              window.HTMLTextAreaElement.prototype,
              'value'
            )?.set;

            if (nativeInputValueSetter) {
              nativeInputValueSetter.call(textarea, result.newValue);
            }

            const inputEvent = new InputEvent('input', { bubbles: true });
            textarea.dispatchEvent(inputEvent);

            requestAnimationFrame(() => {
              textarea.selectionStart = result.cursorPosition;
              textarea.selectionEnd = result.cursorPosition;
            });
          }
        }
      }

      onKeyDown?.(e);
    },
    [onKeyDown]
  );

  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={mergedRef}
      onKeyDown={handleKeyDown}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
