import { PreviewProvider } from "../../components/preview/state";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <PreviewProvider>{children}</PreviewProvider>;
}
