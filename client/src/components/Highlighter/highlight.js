
// KURAL LİSTESİ — uzun/özel desenler önce!

export const HIGHLIGHT_RULES = [
  
  // f-string triple quoted: f"""...""" veya f'''...'''
  { regex: /^[fF](?:"{3}[\s\S]*?"{3}|'{3}[\s\S]*?'{3})/, cls: "token-string" },

  // f-string tek satır: f"..." veya f'...'
  { regex: /^[fF]("(?:\\.|[^"])*"|'(?:\\.|[^'])*')/, cls: "token-string" },

  // Triple‐quoted string (opsiyonel r/b/u önekleri)
  { regex: /^(?:[rRbBuU]?)(?:"{3}[\s\S]*?"{3}|'{3}[\s\S]*?'{3})/, cls: "token-string" },

  // Tek satır string literal'ler (opsiyonel r/b/u önekleri)
  { regex: /^(?:[rRbBuU]?)(?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*')/, cls: "token-string" },

  // Yorum satırları
  { regex: /^#.*/, cls: "token-comment" },

  // Decorator’lar
  { regex: /^@[\w_]+/, cls: "token-decorator" },

  // Python anahtar kelimeler
  { regex: /^\b(?:def|class|self|if|elif|else|for|while|return|import|from|as|with|try|except|finally|in|is|and|or|not|lambda|async|await|yield|pass|break|continue|global|nonlocal|raise|assert)\b/, cls: "token-keyword" },

  // Boolean literal’lar
  { regex: /^\b(?:True|False|None)\b/, cls: "token-boolean" },

  // Built-in fonksiyonlar / bazı kütüphane kısa adları
  { regex: /^\b(?:print|len|range|str|int|float|list|dict|set|tuple|open|sum|min|max|numpy|pandas|sklearn|tensorflow|torch|plt|pd|np)\b/, cls: "token-builtin" },

  // Sayılar
  { regex: /^\b\d+(?:\.\d+)?\b/, cls: "token-number" },

  // Operatörler
  { regex: /^(?:->|--|==|!=|<=|>=|\/\/|\*\*|[=+\-*/%])/, cls: "token-operator" },

  // f-string expression brace'leri
  { regex: /^[\{\}]/, cls: "token-brace" },

  // Noktalama
  { regex: /^[()\:\,.\[\]]/, cls: "token-punctuation" },

  // Magic komut (satır başında % veya !)
  { regex: /^[%!].*/, cls: "token-magic" }, // <-- /g YOK!
];

// Helper: HTML escape
function escapeHtml(str) {
  return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
}

/**
 * Basit tokenizer + highlighter
 * @param {string} code
 * @returns {string} HTML
 */
export function highlightCode(code) {
  let idx = 0;
  const tokens = [];

  while (idx < code.length) {
    const rest = code.slice(idx);
    let matched = false;

    for (const rule of HIGHLIGHT_RULES) {
      // Her turda state'i sıfırla (özellikle /g kalırsa güvenlik payı)
      rule.regex.lastIndex = 0;

      const m = rule.regex.exec(rest);
      if (m) {
        tokens.push({ text: m[0], cls: rule.cls });
        idx += m[0].length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      tokens.push({ text: rest[0] }); // escape edilerek basılacak
      idx += 1;
    }
  }

  return tokens.map(t =>
    t.cls
      ? `<span data-token="${t.cls}">${escapeHtml(t.text)}</span>`
      : escapeHtml(t.text)
  ).join("");
}
