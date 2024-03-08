import React, { useEffect, useMemo } from "react";
import { MessagesProps } from "./props";
import { useChatContext } from "./ChatContext";
import { nanoid } from "nanoid";
import { Message, decodeResult } from "@copilotkit/shared";
import { Markdown } from "./Markdown";
import { useCopilotContext } from "@copilotkit/react-core";

export const Messages = ({ messages, inProgress }: MessagesProps) => {
  const { entryPoints, chatComponentsCache } = useCopilotContext();
  const context = useChatContext();
  const initialMessages = useMemo(
    () => makeInitialMessages(context.labels.initial),
    [context.labels.initial],
  );
  messages = [...initialMessages, ...messages];

  const functionResults: Record<string, string> = {};

  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === "assistant" && messages[i].function_call) {
      const id = messages[i].id;
      if (i + 1 < messages.length && messages[i + 1].role === "function") {
        functionResults[id] = decodeResult(messages[i + 1].content || "");
      }
    }
  }

  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: "auto",
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="copilotKitMessages">
      {messages.map((message, index) => {
        const isCurrentMessage = index === messages.length - 1;

        if (message.role === "user") {
          return (
            <div key={index} className="copilotKitMessage copilotKitUserMessage">
              {message.content}
            </div>
          );
        } else if (message.role == "assistant") {
          if (isCurrentMessage && inProgress && !message.content && !message.partialFunctionCall) {
            // The message is in progress and there is no content- show the spinner
            return (
              <div key={index} className={`copilotKitMessage copilotKitAssistantMessage`}>
                {context.icons.spinnerIcon}
              </div>
            );
          } else if (message.function_call || message.partialFunctionCall) {
            // Find the action that corresponds to the function call if any
            const functionCallName: string = (message.function_call?.name ||
              message.partialFunctionCall?.name)!;
            if (
              chatComponentsCache.current !== null &&
              chatComponentsCache.current[functionCallName]
            ) {
              const render = chatComponentsCache.current[functionCallName];

              // render a static string
              if (typeof render === "string") {
                // when render is static, we show it only when in progress
                if (isCurrentMessage && inProgress) {
                  return (
                    <div key={index} className={`copilotKitMessage copilotKitAssistantMessage`}>
                      {context.icons.spinnerIcon} <span className="inProgressLabel">{render}</span>
                    </div>
                  );
                }
                // show done message
                else {
                  return (
                    <div key={index} className={`copilotKitMessage copilotKitAssistantMessage`}>
                      {context.labels.done}
                    </div>
                  );
                }
              }
              // render is a function
              else {
                const args = message.function_call
                  ? JSON.parse(message.function_call.arguments || "{}")
                  : message.partialFunctionCall?.arguments;

                let status = "inProgress";

                if (functionResults[message.id] !== undefined) {
                  status = "complete";
                } else if (message.function_call) {
                  status = "executing";
                }

                const result = render({
                  status,
                  args,
                  result: functionResults[message.id],
                });

                if (typeof result === "string") {
                  if (isCurrentMessage && inProgress) {
                    return (
                      <div key={index} className={`copilotKitMessage copilotKitAssistantMessage`}>
                        {context.icons.spinnerIcon}
                        <span className="inProgressLabel">{result}</span>
                      </div>
                    );
                  } else {
                    return (
                      <div key={index} className={`copilotKitMessage copilotKitAssistantMessage`}>
                        {result}
                      </div>
                    );
                  }
                } else {
                  return (
                    <div key={index} className="copilotKitCustomAssistantMessage">
                      {result}
                    </div>
                  );
                }
              }
            }
            // No render function found- show the default message
            else if ((!inProgress || !isCurrentMessage) && message.function_call) {
              // Done
              return (
                <div key={index} className={`copilotKitMessage copilotKitAssistantMessage`}>
                  {context.labels.done}
                </div>
              );
            } else {
              // In progress
              return (
                <div key={index} className={`copilotKitMessage copilotKitAssistantMessage`}>
                  {context.icons.spinnerIcon}
                </div>
              );
            }
          }

          return (
            <div key={index} className={`copilotKitMessage copilotKitAssistantMessage`}>
              <Markdown content={message.content} />
            </div>
          );

          // if (isCurrentMessage && inProgress && !message.content) {
          //   // let inProgressLabel = "";

          //   if (message.partialFunctionCall) {
          //     for (const action of Object.values(entryPoints)) {
          //       if (
          //         (action as any).name === message.partialFunctionCall.name &&
          //         (action as any).render
          //       ) {
          //         //       // the label is a function, call it with the arguments
          //         //       if (typeof action.inProgressLabel === "function") {
          //         //         inProgressLabel = action.inProgressLabel(
          //         //           message.partialFunctionCall.arguments as any,
          //         //           // if function_call is undefined, the arguments are incomplete
          //         //           message.function_call !== undefined,
          //         //         );
          //         //       }
          //         //       // the label is a string
          //         //       else {
          //         //         // (don't do an additional type check so we get a compile error if we add a new type)
          //         //         inProgressLabel = action.inProgressLabel;
          //         //       }
          //       }
          //     }
          //   }
          //   return (
          //     <div key={index} className={`copilotKitMessage copilotKitAssistantMessage`}>
          //       {context.icons.spinnerIcon}
          //       {/* {inProgressLabel && <span className="inProgressLabel">{inProgressLabel}</span>} */}
          //     </div>
          //   );
          // } else if (
          //   (!inProgress || index != messages.length - 1) &&
          //   !message.content &&
          //   message.function_call
          // ) {
          //   return (
          //     <div key={index} className={`copilotKitMessage copilotKitAssistantMessage`}>
          //       {context.labels.done}
          //     </div>
          //   );
          // }
          // TODO: Add back partial message
          // This shows up when the assistant is executing a function
          //
          // else if (message.status === "partial") {
          //   return (
          //     <div key={index} className={`copilotKitMessage copilotKitAssistantMessage`}>
          //       {context.labels.thinking} {context.icons.spinnerIcon}
          //     </div>
          //   );
          // }
          // else {
          //   return (
          //     <div key={index} className={`copilotKitMessage copilotKitAssistantMessage`}>
          //       <Markdown content={message.content} />
          //     </div>
          //   );
          // }
        }
        // TODO: Add back function and error messages
        //
        // else if (message.role === "function" && message.status === "success") {
        //   return (
        //     <div key={index} className={`copilotKitMessage copilotKitAssistantMessage`}>
        //       {context.labels.done}
        //     </div>
        //   );
        // } else if (message.status === "error") {
        //   return (
        //     <div key={index} className={`copilotKitMessage copilotKitAssistantMessage`}>
        //       {context.labels.error}
        //     </div>
        //   );
        // }
      })}
      <div ref={messagesEndRef} />
    </div>
  );
};

function makeInitialMessages(initial?: string | string[]): Message[] {
  let initialArray: string[] = [];
  if (initial) {
    if (Array.isArray(initial)) {
      initialArray.push(...initial);
    } else {
      initialArray.push(initial);
    }
  }

  return initialArray.map((message) => ({
    id: nanoid(),
    role: "assistant",
    content: message,
  }));
}
