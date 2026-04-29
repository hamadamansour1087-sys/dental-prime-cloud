import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileBox, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** File or URL of the scan to preview */
  file?: File | null;
  url?: string | null;
  fileName?: string;
}

/**
 * 3D preview dialog for dental scan files (STL / PLY / OBJ).
 * Other formats (.zip, .3mf, .dcm) show a simple file info card.
 */
export function ScanPreviewDialog({ open, onOpenChange, file, url, fileName }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = fileName ?? file?.name ?? "";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const supported = ["stl", "ply", "obj"].includes(ext);

  useEffect(() => {
    if (!open || !supported || !containerRef.current) return;
    let disposed = false;
    let renderer: any;
    let animationId: number;

    const init = async () => {
      setLoading(true);
      setError(null);
      try {
        const THREE = await import("three");
        const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");

        const container = containerRef.current!;
        const width = container.clientWidth;
        const height = container.clientHeight || 400;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0a0a);

        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000);
        camera.position.set(0, 0, 200);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(width, height);
        container.innerHTML = "";
        container.appendChild(renderer.domElement);

        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
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

        let mesh: any;
        if (ext === "stl") {
          const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js");
          const geometry = new STLLoader().parse(buffer as ArrayBuffer);
          geometry.computeVertexNormals();
          const material = new THREE.MeshPhongMaterial({ color: 0xe8e8e8, specular: 0x222222, shininess: 30 });
          mesh = new THREE.Mesh(geometry, material);
        } else if (ext === "ply") {
          const { PLYLoader } = await import("three/examples/jsm/loaders/PLYLoader.js");
          const geometry = new PLYLoader().parse(buffer as ArrayBuffer);
          geometry.computeVertexNormals();
          const material = new THREE.MeshPhongMaterial({ color: 0xe8e8e8, specular: 0x222222, shininess: 30 });
          mesh = new THREE.Mesh(geometry, material);
        } else if (ext === "obj") {
          const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js");
          mesh = new OBJLoader().parse(buffer as string);
        }

        if (!mesh) throw new Error("فشل تحميل الملف");

        // Center & scale
        const box = new THREE.Box3().setFromObject(mesh);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        mesh.position.sub(center);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const scale = 100 / maxDim;
        mesh.scale.setScalar(scale);
        scene.add(mesh);

        camera.position.set(0, 0, 180);
        controls.target.set(0, 0, 0);
        controls.update();

        const animate = () => {
          if (disposed) return;
          animationId = requestAnimationFrame(animate);
          controls.update();
          renderer.render(scene, camera);
        };
        animate();

        const onResize = () => {
          if (!container) return;
          const w = container.clientWidth;
          const h = container.clientHeight || 400;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        };
        window.addEventListener("resize", onResize);

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
      if (renderer) {
        renderer.dispose?.();
        renderer.forceContextLoss?.();
      }
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
        </DialogHeader>
        {supported ? (
          <div className="relative h-[400px] w-full overflow-hidden rounded-lg border bg-black">
            <div ref={containerRef} className="h-full w-full" />
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white">
                <Loader2 className="ml-2 h-5 w-5 animate-spin" /> جارٍ تحميل المعاينة...
              </div>
            )}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4 text-center text-sm text-destructive">
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
