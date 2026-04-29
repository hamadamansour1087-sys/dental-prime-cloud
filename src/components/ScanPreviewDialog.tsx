import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileBox, Loader2 } from "lucide-react";

type ThreeObject = {
  isMesh?: boolean;
  material?: unknown;
  geometry?: { computeVertexNormals?: () => void };
  traverse?: (callback: (child: ThreeObject) => void) => void;
  position: { sub: (value: unknown) => void };
  scale: { setScalar: (value: number) => void };
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** File or URL of the scan to preview */
  file?: File | null;
  url?: string | null;
  fileName?: string;
}

/**
 * 3D preview dialog for dental scan files (STL / PLY / OBJ / 3MF).
 * Other formats (.zip, .dcm) show a simple file info card.
 */
export function ScanPreviewDialog({ open, onOpenChange, file, url, fileName }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = fileName ?? file?.name ?? "";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const supported = ["stl", "ply", "obj", "3mf"].includes(ext);

  useEffect(() => {
    if (!open || !supported || !containerRef.current) return;
    let disposed = false;
    let renderer: { dispose?: () => void; forceContextLoss?: () => void; render: (scene: unknown, camera: unknown) => void; setPixelRatio: (value: number) => void; setSize: (width: number, height: number) => void; domElement: HTMLCanvasElement } | undefined;
    let animationId: number;
    let resizeObserver: ResizeObserver | undefined;

    const waitForContainerSize = async () => {
      for (let i = 0; i < 20; i += 1) {
        const container = containerRef.current;
        const width = container?.clientWidth ?? 0;
        const height = container?.clientHeight ?? 0;
        if (width > 40 && height > 40) return { width, height };
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      const container = containerRef.current;
      return { width: Math.max(container?.clientWidth ?? 320, 320), height: Math.max(container?.clientHeight ?? 400, 320) };
    };

    const init = async () => {
      setLoading(true);
      setError(null);
      try {
        const THREE = await import("three");
        const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");

        const container = containerRef.current!;
        const { width, height } = await waitForContainerSize();
        if (disposed) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf8fafc);

        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000);
        camera.position.set(120, 80, 220);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(width, height);
        renderer.domElement.style.display = "block";
        renderer.domElement.style.width = "100%";
        renderer.domElement.style.height = "100%";
        container.innerHTML = "";
        container.appendChild(renderer.domElement);

        scene.add(new THREE.AmbientLight(0xffffff, 0.75));
        const dir1 = new THREE.DirectionalLight(0xffffff, 0.8);
        dir1.position.set(1, 1, 1);
        scene.add(dir1);
        const dir2 = new THREE.DirectionalLight(0xffffff, 0.4);
        dir2.position.set(-1, -1, -1);
        scene.add(dir2);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;

        // Read file
        let buffer: ArrayBuffer | string;
        if (file) {
          buffer = ext === "obj" ? await file.text() : await file.arrayBuffer();
        } else if (url) {
          const res = await fetch(url);
          buffer = ext === "obj" ? await res.text() : await res.arrayBuffer();
        } else {
          throw new Error("لا يوجد ملف للمعاينة");
        }

        let mesh: ThreeObject | undefined;
        const material = new THREE.MeshPhongMaterial({ color: 0xd9dde3, specular: 0x333333, shininess: 40, side: THREE.DoubleSide });
        if (ext === "stl") {
          const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js");
          const geometry = new STLLoader().parse(buffer as ArrayBuffer);
          geometry.computeVertexNormals();
          mesh = new THREE.Mesh(geometry, material);
        } else if (ext === "ply") {
          const { PLYLoader } = await import("three/examples/jsm/loaders/PLYLoader.js");
          const geometry = new PLYLoader().parse(buffer as ArrayBuffer);
          geometry.computeVertexNormals();
          mesh = new THREE.Mesh(geometry, material);
        } else if (ext === "obj") {
          const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js");
          mesh = new OBJLoader().parse(buffer as string);
          mesh.traverse?.((child) => {
            if (child.isMesh) {
              child.material = material;
              child.geometry?.computeVertexNormals?.();
            }
          });
        } else if (ext === "3mf") {
          const { ThreeMFLoader } = await import("three/examples/jsm/loaders/3MFLoader.js");
          mesh = new ThreeMFLoader().parse(buffer as ArrayBuffer) as unknown as ThreeObject;
          mesh.traverse?.((child) => {
            if (child.isMesh && !child.material) {
              child.material = material;
            }
            child.geometry?.computeVertexNormals?.();
          });
        }

        if (!mesh) throw new Error("فشل تحميل الملف");

        // Center & scale
        const box = new THREE.Box3().setFromObject(mesh);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        mesh.position.sub(center);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const scale = 120 / maxDim;
        mesh.scale.setScalar(scale);
        scene.add(mesh);

        const fittedBox = new THREE.Box3().setFromObject(mesh);
        const sphere = fittedBox.getBoundingSphere(new THREE.Sphere());
        const radius = Math.max(sphere.radius, 10);
        const distance = radius / Math.sin((camera.fov * Math.PI) / 360) * 1.25;
        camera.near = Math.max(distance / 100, 0.1);
        camera.far = distance * 100;
        camera.position.set(radius * 0.8, radius * 0.55, distance);
        camera.updateProjectionMatrix();
        controls.target.copy(sphere.center);
        controls.update();

        const animate = () => {
          if (disposed) return;
          animationId = requestAnimationFrame(animate);
          controls.update();
          renderer?.render(scene, camera);
        };
        animate();

        const onResize = () => {
          if (!container || disposed) return;
          const w = container.clientWidth;
          const h = container.clientHeight || 400;
          if (w <= 0 || h <= 0) return;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        };
        resizeObserver = new ResizeObserver(onResize);
        resizeObserver.observe(container);

        setLoading(false);
      } catch (e: any) {
        setError(e?.message ?? "تعذرت المعاينة");
        setLoading(false);
      }
    };
    init();

    return () => {
      disposed = true;
      if (animationId) cancelAnimationFrame(animationId);
      resizeObserver?.disconnect();
      if (renderer) {
        renderer.dispose?.();
        renderer.forceContextLoss?.();
      }
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [open, supported, file, url, ext]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileBox className="h-5 w-5" />
            <span dir="ltr" className="truncate text-sm">{name}</span>
          </DialogTitle>
          <DialogDescription>
            معاينة ملف الإسكان قبل حفظ الحالة.
          </DialogDescription>
        </DialogHeader>
        {supported ? (
          <div className="relative h-[420px] min-h-[320px] w-full overflow-hidden rounded-lg border bg-muted/20">
            <div ref={containerRef} className="h-full w-full" />
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 text-foreground">
                <Loader2 className="ml-2 h-5 w-5 animate-spin" /> جارٍ تحميل المعاينة...
              </div>
            )}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/90 p-4 text-center text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/40 p-8 text-center">
            <FileBox className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
            <p className="text-sm font-semibold">{name}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              لا تتوفر معاينة 3D لصيغة <span className="font-mono">.{ext}</span>
              <br />
              الملف محفوظ مع الحالة وسيتم رفعه عند الحفظ.
            </p>
          </div>
        )}
        <p className="text-center text-xs text-muted-foreground">
          اسحب للتدوير • عجلة الفأرة للتكبير • زر يمين للتحريك
        </p>
      </DialogContent>
    </Dialog>
  );
}
