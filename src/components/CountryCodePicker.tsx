import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Check } from "lucide-react";

export const COUNTRY_CODES = [
  { code: "+1", flag: "🇺🇸", name: "United States" },
  { code: "+1", flag: "🇨🇦", name: "Canada" },
  { code: "+44", flag: "🇬🇧", name: "United Kingdom" },
  { code: "+91", flag: "🇮🇳", name: "India" },
  { code: "+61", flag: "🇦🇺", name: "Australia" },
  { code: "+33", flag: "🇫🇷", name: "France" },
  { code: "+49", flag: "🇩🇪", name: "Germany" },
  { code: "+81", flag: "🇯🇵", name: "Japan" },
  { code: "+82", flag: "🇰🇷", name: "South Korea" },
  { code: "+86", flag: "🇨🇳", name: "China" },
  { code: "+55", flag: "🇧🇷", name: "Brazil" },
  { code: "+52", flag: "🇲🇽", name: "Mexico" },
  { code: "+34", flag: "🇪🇸", name: "Spain" },
  { code: "+39", flag: "🇮🇹", name: "Italy" },
  { code: "+7", flag: "🇷🇺", name: "Russia" },
  { code: "+27", flag: "🇿🇦", name: "South Africa" },
  { code: "+234", flag: "🇳🇬", name: "Nigeria" },
  { code: "+20", flag: "🇪🇬", name: "Egypt" },
  { code: "+971", flag: "🇦🇪", name: "UAE" },
  { code: "+966", flag: "🇸🇦", name: "Saudi Arabia" },
  { code: "+92", flag: "🇵🇰", name: "Pakistan" },
  { code: "+880", flag: "🇧🇩", name: "Bangladesh" },
  { code: "+62", flag: "🇮🇩", name: "Indonesia" },
  { code: "+63", flag: "🇵🇭", name: "Philippines" },
  { code: "+84", flag: "🇻🇳", name: "Vietnam" },
  { code: "+66", flag: "🇹🇭", name: "Thailand" },
  { code: "+60", flag: "🇲🇾", name: "Malaysia" },
  { code: "+65", flag: "🇸🇬", name: "Singapore" },
  { code: "+90", flag: "🇹🇷", name: "Turkey" },
  { code: "+31", flag: "🇳🇱", name: "Netherlands" },
  { code: "+46", flag: "🇸🇪", name: "Sweden" },
  { code: "+47", flag: "🇳🇴", name: "Norway" },
  { code: "+45", flag: "🇩🇰", name: "Denmark" },
  { code: "+358", flag: "🇫🇮", name: "Finland" },
  { code: "+353", flag: "🇮🇪", name: "Ireland" },
  { code: "+48", flag: "🇵🇱", name: "Poland" },
  { code: "+30", flag: "🇬🇷", name: "Greece" },
  { code: "+972", flag: "🇮🇱", name: "Israel" },
  { code: "+54", flag: "🇦🇷", name: "Argentina" },
  { code: "+56", flag: "🇨🇱", name: "Chile" },
  { code: "+57", flag: "🇨🇴", name: "Colombia" },
  { code: "+51", flag: "🇵🇪", name: "Peru" },
  { code: "+58", flag: "🇻🇪", name: "Venezuela" },
  { code: "+64", flag: "🇳🇿", name: "New Zealand" },
];

type Props = { value: string; onChange: (v: string) => void };

export default function CountryCodePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const selected = COUNTRY_CODES.find((c) => c.code === value) || COUNTRY_CODES[0];
  const filtered = COUNTRY_CODES.filter((c) =>
    c.name.toLowerCase().includes(q.toLowerCase()) || c.code.includes(q)
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="h-12 px-4 rounded-full bg-white shadow-[var(--shadow-pill)] flex items-center gap-2 font-semibold text-sm shrink-0">
          <span className="text-lg">{selected.flag}</span>
          <span>{selected.code}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-2 w-72 max-h-80 overflow-y-auto rounded-2xl">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search country" className="rounded-full mb-2 h-10" />
        {filtered.map((c, i) => (
          <button
            key={`${c.code}-${c.name}-${i}`}
            onClick={() => { onChange(c.code); setOpen(false); }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted text-left"
          >
            <span className="text-xl">{c.flag}</span>
            <span className="flex-1 text-sm">{c.name}</span>
            <span className="text-sm text-muted-foreground">{c.code}</span>
            {c.code === value && <Check className="w-4 h-4" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
