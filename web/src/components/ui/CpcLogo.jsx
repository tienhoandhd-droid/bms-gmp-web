// CpcLogo.jsx — logo CPC1 Hà Nội (tách move-only từ App.jsx 17/08/2026).
import React from "react";
import logoCpc1hn from "../../assets/logo-cpc1hn.png";

export default function CpcLogo({ className = "h-9 w-auto" }) { return <img src={logoCpc1hn} alt="CPC1 Hà Nội" className={`${className} object-contain select-none`} draggable={false} />; }
