"use client";
import React, { useRef, useEffect, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import socket from "../socket";

const XTerminal: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const [term, setTerm] = useState<Terminal | null>(null);
  const prompt = "bash-3.2$ "; // Add a space for better readability

  useEffect(() => {
    const terminal = new Terminal({
      fontFamily: "Menlo, Monaco, monospace",
      theme: {
        background: "#000000",
        foreground: "#f0f0f0",
      },
      scrollOnUserInput: true, // Ensures scrolling when the user types
      rows: 20
    });
    // const fitAddon = new FitAddon();
    // terminal.loadAddon(fitAddon);
    setTerm(terminal);

    return () => {
      if (terminal) {
        terminal.dispose();
      }
    };
  }, []);

  useEffect(() => {
    if (term) {
      if (terminalRef.current) {
        term.open(terminalRef.current);
        term.write(prompt);
      }

      let currentInput = ""; // To track user input after the prompt

      const handleData = (data: string) => {
        if (data === "\r") {
          // Handle Enter key
          const cols = term.cols;
          term.write("\r" + " ".repeat(cols) + "\r");
          term.write("\x1B[A");
          term.write(`\r\n${prompt}`);
          
          if (currentInput === "clear") {
            term.clear();
            currentInput = ""; // Reset input
            return;
          }
          
          socket.emit("terminal:write", currentInput);
          currentInput = "";
          
          term.scrollToBottom(); // Scroll down after input
        } else if (data.charCodeAt(0) === 127) {
          // Handle Backspace key
          if (currentInput.length > 0) {
            term.write("\b \b"); // Erase character
            currentInput = currentInput.slice(0, -1); // Update input
          }
        } else {
          // Handle any other key
          term.write(data);
          currentInput += data; // Track the user input
        }
      };

      const handleClear = () => {
        term.clear();
        term.scrollToBottom(); // Ensure it's scrolled to the bottom
      };

      const onTerminalData = (data: any) => {
        term.write(data);
        term.scrollToBottom(); // Scroll down when new data is received
      };

      socket.on("terminal:data", onTerminalData);

      const disposable = term.onData((data) => {
        if (data === "\x0C") {
          // Handle Ctrl+L (clear)
          handleClear();
        } else {
          handleData(data);
        }
      });

      return () => {
        disposable.dispose();
        socket.off("terminal:data", onTerminalData);
      };
    }
  }, [term]);

  return <div className="h-[97%] overflow-y-auto" ref={terminalRef}></div>;
};

export default XTerminal;
