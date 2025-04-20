"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import socket from "../socket";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/resizeable";
import Editor, { DiffEditor, useMonaco, loader } from "@monaco-editor/react";
import { ChevronDown, ChevronRight } from "lucide-react";

const XTerminal = dynamic(() => import("../components/terminal"), {
  ssr: false,
});

type FolderProps = {
  name: string;
  children: React.ReactNode;
  path: string;
};

type FileProps = {
  name: string;
  path: string;
  onClick: (path: string) => void;
};

const Tree: any = ({ tree, onFileClick }: any) => {
  return (
    <div className="p-2 text-sm text-gray-800">
      {renderTree(tree, "", onFileClick)}
    </div>
  );
};

const Folder: React.FC<FolderProps> = ({ name, children, path }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <div
        className="flex text-[#BFBFBF] items-center gap-1 pl-2 py-0.5 cursor-pointer hover:bg-gray-800"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span className="font-medium">{name}</span>
      </div>
      {isOpen && <div className="pl-4">{children}</div>}
    </div>
  );
};

const File: React.FC<FileProps> = ({ name, path, onClick }) => {
  return (
    <div
      className="flex text-[#BFBFBF] items-center cursor-pointer gap-1 pl-2 py-0.5 hover:bg-gray-800"
      onClick={() => {
        onClick(path);
      }}
    >
      <span>{name}</span>
    </div>
  );
};

const renderTree = (
  tree: any,
  parentPath: string,
  onFileClick?: (path: string) => void
) => {
  return Object.entries(tree).map(([key, value]) => {
    const currentPath = parentPath ? `${parentPath}/${key}` : key;
    if (value === null) {
      return (
        <File
          key={key}
          name={key}
          path={currentPath}
          onClick={onFileClick || (() => {})}
        />
      );
    }
    return (
      <Folder key={key} name={key} path={currentPath}>
        {renderTree(value, currentPath, onFileClick)}
      </Folder>
    );
  });
};

const CodeEditor = ({ code, setCode }: any) => {
  const handleEditorChange = (value: any, event: any) => {
    setCode(value);
  };
  return (
    <Editor
      defaultLanguage="javascript"
      theme="vs-dark"
      defaultValue={code.toString()}
      value={code}
      onChange={handleEditorChange}
    />
  );
};

const MainComponent = () => {
  const [treeData, setTreeData] = useState({});
  const [filePath, setFilePath] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [code, setCode] = useState("");
  const [openFiles, setOpenFiles] = useState<Set<string>>(new Set<string>());
  const isSaved = fileContent === code;

  const getFileNameByPath = (filePath: any) => {
    return filePath?.split("/")?.slice(-1)[0];
  };

  const onFiles = (files: any) => {
    setTreeData(files.tree);
  };
  const handler = (path: string) => {
    if (path !== filePath) {
      setFilePath(path); // Set the selected file path properly
    }
  };

  console.log(openFiles);

  socket.on("files", onFiles);

  const getFileTree = async () => {
    const response = await fetch("http://localhost:8080/files");
    const result: any = await response.json();
    setTreeData(result?.tree);
  };

  const getFileContents = useCallback(async () => {
    if (!filePath) return;
    const response = await fetch(
      `http://localhost:8080/files/content?path=${filePath}`
    );
    const result = await response.json();
    setFileContent(result.content);
  }, [filePath]);

  const removeOpenFile = (filePath: string) => {
    const updatedOpenFiles = new Set(openFiles);
    updatedOpenFiles.delete(filePath);
    const finalSet = new Set(updatedOpenFiles);
    setOpenFiles(finalSet);
    setFilePath(
      finalSet?.size === 0 ? "" : Array?.from(finalSet)?.slice(-1)[0]
    );
  };

  useEffect(() => {
    getFileTree();
  }, []);

  useEffect(() => {
    if (filePath) {
      setOpenFiles((prevOpenFiles: any) => {
        if (!prevOpenFiles.has(filePath)) {
          return new Set([...prevOpenFiles, filePath]); // Properly add the file
        }
        return prevOpenFiles; // Prevent unnecessary updates
      });

      getFileContents(); // Ensure file content is fetched
    }
  }, [filePath]);

  useEffect(() => {
    if (!isSaved) {
      const timer = setTimeout(() => {
        socket.emit(
          "file:write",
          JSON.stringify({
            path: filePath,
            content: code,
          })
        );
      }, 1 * 1000);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [code, filePath, isSaved]);

  useEffect(() => {
    setCode("");
  }, [filePath]);

  useEffect(() => {
    setCode(fileContent);
  }, [fileContent]);

  return (
    <>
      <div className="flex justify-center py-2 bg-gray-950 text-[0.875rem] text-[#FFF] font-semibold">
        project-name
      </div>
      <ResizablePanelGroup direction="horizontal" className="">
        <ResizablePanel
          className="bg-gray-900 text-gray-200"
          defaultSize={15}
          maxSize={30}
          minSize={15}
        >
          <div className="px-4 py-2.5 text-[0.65rem] bg-gray-900">EXPLORER</div>
          <div className="px-4 py-1.5 text-[0.8rem] bg-gray-950">
            project-name
          </div>
          <div className="">
            <Tree onFileClick={handler} tree={treeData} />
          </div>
        </ResizablePanel>
        <ResizableHandle className="hover:bg-blue-500 active:bg-blue-500 transition-all ease-in-out w-[0.15rem] bg-gray-900" />
        <ResizablePanel className="h-[100vh]">
          <ResizablePanelGroup direction="vertical" className="">
            <ResizablePanel className="pr-4 bg-[#1E1E1E]">
              <div className="flex text-[0.75rem] bg-[#1E1E1E] text-[#BFBFBF]">
                {Array.from(openFiles).map((file: any, index: number) => {
                  return (
                    <div className="flex items-center">
                      <div
                        className={`py-1.5 pl-4 cursor-pointer ${
                          file === filePath
                            ? "bg-black border-b border-[#BFBFBF]"
                            : "border-black"
                        }`}
                        onClick={() => {
                          setFilePath(file);
                        }}
                      >
                        <div className="flex gap-3">
                          <div>{getFileNameByPath(file)}</div>
                        </div>
                      </div>
                      <div
                        className={`flex items-center h-full px-2 cursor-pointer ${
                          file === filePath
                            ? "bg-black border-b border-[#BFBFBF]"
                            : "border-black border-r"
                        }`}
                      >
                        <button
                          className="rounded-full p-[0.12rem] hover:bg-white/25"
                          onClick={() => removeOpenFile(file)}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="1"
                            stroke="currentColor"
                            className="size-3"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              d="M6 18 18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center pl-3 py-2 text-[0.75rem] bg-[#1E1E1E] text-[#BFBFBF]">
                {filePath.split("/").map((file: any, index: number) => {
                  return (
                    <>
                      <span className="mx-1">{file}</span>
                      {index !== filePath?.split("/")?.length - 1 && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke-width="1.5"
                          stroke="currentColor"
                          className="size-3 scale-90"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="m8.25 4.5 7.5 7.5-7.5 7.5"
                          />
                        </svg>
                      )}
                    </>
                  );
                })}
              </div>
              {filePath && <CodeEditor code={code} setCode={setCode} />}
            </ResizablePanel>
            <ResizableHandle className="hover:bg-blue-500 active:bg-blue-500 w-1" />
            <ResizablePanel
              className="bg-black pl-3 pt-1.5"
              defaultSize={40}
              minSize={10}
              maxSize={50}
            >
              <XTerminal />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </>
  );
};

export default function Page() {
  return <MainComponent />;
}
