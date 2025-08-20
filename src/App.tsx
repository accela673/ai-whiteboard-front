import { useRef, useState, useEffect } from "react";
import { Stage, Layer, Line } from "react-konva";
import { io } from "socket.io-client";

interface LineType {
  id?: number;
  points: number[];
  color: string;
  strokeWidth: number;
  tool: "pen" | "eraser";
}

const socket = io("http://localhost:5050"); // backend URL без /api

export default function App() {
  const [lines, setLines] = useState<LineType[]>([]);
  const [color, setColor] = useState("#ff0000ff");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const isDrawing = useRef(false);

  const boardId = 1; // заменяем на динамический ID при необходимости

  useEffect(() => {
    // join room
    socket.emit("join_room", boardId.toString());

    // получаем линии с сервера при подключении
    socket.on("load_lines", (existingLines: any[]) => {
      setLines(existingLines.map(line => ({
        ...line,
        points: Array.isArray(line.points) ? line.points : JSON.parse(line.points),
      })));
    });

    socket.on("draw", (line: any) => {
      setLines(prev => [...prev, {
        ...line,
        points: Array.isArray(line.points) ? line.points : JSON.parse(line.points),
      }]);
    });

    return () => {
      socket.off("load_lines");
      socket.off("draw");
    };
  }, []);

  const handleMouseDown = (e: any) => {
    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();
    setLines([...lines, { points: [pos.x, pos.y], color, strokeWidth, tool }]);
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing.current) return;
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    const lastLine = lines[lines.length - 1];
    lastLine.points = lastLine.points.concat([point.x, point.y]);
    setLines([...lines.slice(0, lines.length - 1), lastLine]);
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
    const lastLine = lines[lines.length - 1];
    if (lastLine) {
      setLines(prev => [...prev]); // обновляем state
      socket.emit("draw", { roomId: boardId.toString(), line: lastLine });
    }
  };

  const clearBoard = () => setLines([]);

  return (
    <div className="flex flex-col h-screen">
      <header className="p-2 bg-gray-200 flex justify-between items-center">
        <h1 className="font-bold text-lg">AI Whiteboard</h1>
        <div className="flex gap-2 items-center">
          <button onClick={() => setTool("pen")} className={`px-3 py-1 rounded ${tool === "pen" ? "bg-blue-500 text-white" : "bg-gray-300"}`}>Pen</button>
          <button onClick={() => setTool("eraser")} className={`px-3 py-1 rounded ${tool === "eraser" ? "bg-red-500 text-white" : "bg-gray-300"}`}>Eraser</button>
          {tool === "pen" && <>
            <label>Color: </label>
            <input type="color" value={color} onChange={e => setColor(e.target.value)} />
          </>}
          <label>Width: </label>
          <input type="range" min={1} max={20} value={strokeWidth} onChange={e => setStrokeWidth(Number(e.target.value))} />
          <button onClick={clearBoard} className="bg-red-600 text-white px-3 py-1 rounded">Clear</button>
        </div>
      </header>

      <Stage width={window.innerWidth} height={window.innerHeight - 50} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
        <Layer>
          {lines.map((line, i) => (
            <Line key={i} points={line.points} stroke={line.color} strokeWidth={line.strokeWidth} tension={0.5} lineCap="round" lineJoin="round" globalCompositeOperation={line.tool === "eraser" ? "destination-out" : "source-over"} />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
