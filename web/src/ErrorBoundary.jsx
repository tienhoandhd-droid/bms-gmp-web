// ============================================================
// ErrorBoundary.jsx — chặn "trắng cả trang" khi 1 component lỗi runtime.
// React chỉ dừng cây con bị lỗi thay vì gỡ toàn bộ nếu có boundary bao ngoài.
// Dùng 2 tầng: 1 boundary gốc (bọc <App/>) + boundary con quanh biểu đồ/tab nặng
// → lỗi 1 biểu đồ chỉ hỏng đúng thẻ đó, phần còn lại của trang vẫn chạy.
// 0 dependency; giao diện fallback tối giản, tiếng Việt.
// ============================================================
import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, err: null };
  }
  static getDerivedStateFromError(err) {
    return { hasError: true, err };
  }
  componentDidCatch(err, info) {
    // Ghi ra console để còn debug; không nuốt lỗi im lặng.
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", this.props.ten || "root", err, info?.componentStack);
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    // Fallback GỌN cho boundary con (quanh biểu đồ): chỉ 1 dòng, không chiếm trang.
    if (this.props.gon) {
      return (
        <div className="rounded-2xl bg-danger-soft ring-1 ring-danger-line text-danger text-[12px] px-3 py-4 text-center">
          Không hiển thị được phần này. Dữ liệu khác vẫn hoạt động bình thường.
        </div>
      );
    }
    // Fallback gốc (bọc toàn App): giữ trang sống + cho tải lại.
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "var(--bg-canvas)",
          fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 440,
            width: "100%",
            background: "rgba(255,255,255,0.96)",
            borderRadius: 24,
            padding: "32px 28px",
            textAlign: "center",
            boxShadow: "0 20px 60px -20px rgba(16,40,55,0.35)",
            border: "1px solid #D8E6EC",
          }}
        >
          <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "#1E3A56", margin: "0 0 8px" }}>
            Giao diện gặp sự cố hiển thị
          </h1>
          <p style={{ fontSize: 13, color: "#4A6072", margin: "0 0 20px", lineHeight: 1.5 }}>
            Đã có lỗi khi dựng trang. Dữ liệu giám sát trên Supabase KHÔNG bị ảnh hưởng.
            Vui lòng tải lại trang; nếu còn lỗi, báo IT kèm ảnh chụp màn hình.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#fff",
              background: "#0E7C6B",
              border: "none",
              borderRadius: 14,
              padding: "10px 22px",
              cursor: "pointer",
            }}
          >
            Tải lại trang
          </button>
          {this.state.err?.message ? (
            <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 16, wordBreak: "break-word" }}>
              {String(this.state.err.message).slice(0, 200)}
            </p>
          ) : null}
        </div>
      </div>
    );
  }
}
