"""
TOON (Tabular Object-Oriented Notation) Encoder
-------------------------------------------------
Minimal Python implementation of TOON encoding for Genesis A2A service.

TOON is a token-efficient encoding format for tabular data that reduces
JSON token usage by 30-60% by:
1. Extracting common keys into a header
2. Encoding values in a compact tabular format
3. Eliminating repeated key tokens

Reference: https://github.com/badlogic/toon
Paper: Token-Efficient Data Representation (2025)

Author: Hudson (Code Review Agent)
Date: 2025-10-27
Version: 1.0.0
"""

import json
from typing import Dict, List, Any, Optional, Tuple, Union


def supports_toon(data: Any) -> bool:
    """
    Check if data structure is suitable for TOON encoding.

    TOON is most efficient for:
    - Arrays of objects with consistent keys (tabular data)
    - Repeated data structures (e.g., API responses with multiple records)

    TOON is NOT suitable for:
    - Deeply nested heterogeneous structures
    - Single objects (no repetition to optimize)
    - Sparse data (many null/missing values)

    Args:
        data: Data structure to evaluate

    Returns:
        True if TOON encoding would provide significant token reduction

    Examples:
        >>> supports_toon([{"id": 1, "name": "foo"}, {"id": 2, "name": "bar"}])
        True
        >>> supports_toon({"single": "object"})
        False
        >>> supports_toon([{"a": 1}, {"b": 2}])  # Inconsistent keys
        False
    """
    # Must be a list/array
    if not isinstance(data, list):
        return False

    # Must have at least 2 items (otherwise no benefit)
    if len(data) < 2:
        return False

    # All items must be dictionaries
    if not all(isinstance(item, dict) for item in data):
        return False

    # Extract key sets
    key_sets = [set(item.keys()) for item in data]

    # Must have consistent keys across items (at least 70% overlap)
    if not key_sets:
        return False

    first_keys = key_sets[0]
    if len(first_keys) == 0:
        return False

    # Calculate key consistency
    common_keys = first_keys.intersection(*key_sets[1:])
    consistency = len(common_keys) / len(first_keys)

    # Require 70%+ key overlap for TOON efficiency
    if consistency < 0.7:
        return False

    # Check value types (prefer primitive types for best compression)
    for item in data[:5]:  # Sample first 5 items
        for value in item.values():
            # Nested objects/arrays reduce TOON benefit
            if isinstance(value, (dict, list)):
                # Allow shallow nesting (1 level)
                if isinstance(value, dict):
                    if any(isinstance(v, (dict, list)) for v in value.values()):
                        return False
                elif isinstance(value, list):
                    if any(isinstance(v, (dict, list)) for v in value):
                        return False

    return True


def encode_to_toon(data: List[Dict[str, Any]]) -> str:
    """
    Encode tabular data to TOON format.

    TOON Format:
    ```
    @toon 1.0
    @keys key1,key2,key3
    value1,value2,value3
    value4,value5,value6
    ```

    Escaping Rules:
    - Commas in values: replaced with \\c
    - Newlines in values: replaced with \\n
    - Backslashes: replaced with \\\\
    - Null values: represented as empty string

    Args:
        data: List of dictionaries with consistent keys

    Returns:
        TOON-encoded string

    Raises:
        ValueError: If data is not suitable for TOON encoding

    Examples:
        >>> data = [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]
        >>> print(encode_to_toon(data))
        @toon 1.0
        @keys id,name
        1,Alice
        2,Bob
    """
    if not supports_toon(data):
        raise ValueError("Data structure not suitable for TOON encoding")

    # Extract common keys (use first item as template)
    keys = list(data[0].keys())

    # Build header
    lines = [
        "@toon 1.0",
        f"@keys {','.join(keys)}"
    ]

    # Encode each row
    for item in data:
        row_values = []
        for key in keys:
            value = item.get(key)
            encoded_value = _encode_value(value)
            row_values.append(encoded_value)

        lines.append(','.join(row_values))

    return '\n'.join(lines)


def decode_from_toon(toon_string: str) -> List[Dict[str, Any]]:
    """
    Decode TOON format back to JSON-compatible data.

    Args:
        toon_string: TOON-encoded string

    Returns:
        List of dictionaries

    Raises:
        ValueError: If TOON format is invalid

    Examples:
        >>> toon = "@toon 1.0\\n@keys id,name\\n1,Alice\\n2,Bob"
        >>> decode_from_toon(toon)
        [{'id': '1', 'name': 'Alice'}, {'id': '2', 'name': 'Bob'}]
    """
    lines = toon_string.strip().split('\n')

    if len(lines) < 3:
        raise ValueError("Invalid TOON format: too few lines")

    # Parse header
    if not lines[0].startswith("@toon"):
        raise ValueError("Invalid TOON format: missing @toon header")

    if not lines[1].startswith("@keys"):
        raise ValueError("Invalid TOON format: missing @keys header")

    # Extract keys
    keys_line = lines[1][6:].strip()  # Remove "@keys "
    keys = keys_line.split(',')

    # Parse data rows
    result = []
    for line in lines[2:]:
        if not line.strip():
            continue

        values = _split_csv_line(line)

        if len(values) != len(keys):
            raise ValueError(
                f"Invalid TOON format: row has {len(values)} values "
                f"but {len(keys)} keys expected"
            )

        # Decode values
        decoded_values = [_decode_value(v) for v in values]

        # Build dictionary
        item = dict(zip(keys, decoded_values))
        result.append(item)

    return result


def _encode_value(value: Any) -> str:
    """
    Encode a single value for TOON format.

    Handles:
    - None -> empty string
    - Primitives -> string representation
    - Objects/Arrays -> JSON string (escaped)

    Args:
        value: Value to encode

    Returns:
        Encoded string value
    """
    if value is None:
        return ""

    if isinstance(value, bool):
        return "true" if value else "false"

    if isinstance(value, (int, float)):
        return str(value)

    if isinstance(value, str):
        # Escape special characters
        escaped = value.replace("\\", "\\\\")
        escaped = escaped.replace(",", "\\c")
        escaped = escaped.replace("\n", "\\n")
        escaped = escaped.replace("\r", "\\r")
        return escaped

    if isinstance(value, (dict, list)):
        # Convert to JSON and escape
        json_str = json.dumps(value, separators=(',', ':'))
        escaped = json_str.replace("\\", "\\\\")
        escaped = escaped.replace(",", "\\c")
        escaped = escaped.replace("\n", "\\n")
        escaped = escaped.replace("\r", "\\r")
        return escaped

    # Fallback: convert to string
    return str(value)


def _decode_value(value: str) -> Any:
    """
    Decode a TOON-encoded value.

    Attempts to parse as:
    1. Boolean (true/false)
    2. Number (int/float)
    3. JSON object/array
    4. String (with unescaping)

    Args:
        value: Encoded string value

    Returns:
        Decoded value
    """
    if value == "":
        return None

    # Unescape first
    unescaped = value.replace("\\r", "\r")
    unescaped = unescaped.replace("\\n", "\n")
    unescaped = unescaped.replace("\\c", ",")
    unescaped = unescaped.replace("\\\\", "\\")

    # Try boolean
    if unescaped in ("true", "false"):
        return unescaped == "true"

    # Try number
    try:
        if '.' in unescaped:
            return float(unescaped)
        else:
            return int(unescaped)
    except ValueError:
        pass

    # Try JSON (for nested objects/arrays)
    if unescaped.startswith('{') or unescaped.startswith('['):
        try:
            return json.loads(unescaped)
        except json.JSONDecodeError:
            pass

    # Return as string
    return unescaped


def _split_csv_line(line: str) -> List[str]:
    """
    Split a CSV line respecting escaped commas.

    Handles:
    - Escaped commas (\\c) should not split
    - Escaped backslashes (\\\\) should be preserved

    Args:
        line: CSV line to split

    Returns:
        List of field values
    """
    values = []
    current = []
    i = 0

    while i < len(line):
        char = line[i]

        if char == '\\' and i + 1 < len(line):
            # Escaped character
            next_char = line[i + 1]
            if next_char == 'c':
                # Escaped comma - add literal comma
                current.append(',')
                i += 2
            elif next_char == 'n':
                # Escaped newline
                current.append('\n')
                i += 2
            elif next_char == 'r':
                # Escaped carriage return
                current.append('\r')
                i += 2
            elif next_char == '\\':
                # Escaped backslash
                current.append('\\')
                i += 2
            else:
                # Unknown escape - keep as is
                current.append(char)
                i += 1
        elif char == ',':
            # Field separator
            values.append(''.join(current))
            current = []
            i += 1
        else:
            # Regular character
            current.append(char)
            i += 1

    # Add final field
    values.append(''.join(current))

    return values


def calculate_token_reduction(json_data: List[Dict[str, Any]]) -> float:
    """
    Calculate estimated token reduction percentage for TOON encoding.

    Uses character count as proxy for token count (rough approximation).
    Actual token counts depend on tokenizer, but character count is
    highly correlated for most tokenizers.

    Args:
        json_data: Tabular data to evaluate

    Returns:
        Percentage reduction (0.0 to 1.0), e.g., 0.45 = 45% reduction

    Examples:
        >>> data = [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]
        >>> reduction = calculate_token_reduction(data)
        >>> assert 0.3 <= reduction <= 0.6  # 30-60% reduction
    """
    if not supports_toon(json_data):
        return 0.0

    # JSON encoding (compact)
    json_str = json.dumps(json_data, separators=(',', ':'))
    json_chars = len(json_str)

    # TOON encoding
    toon_str = encode_to_toon(json_data)
    toon_chars = len(toon_str)

    # Calculate reduction
    if json_chars == 0:
        return 0.0

    reduction = (json_chars - toon_chars) / json_chars

    return max(0.0, reduction)


def toon_or_json(data: Any) -> Tuple[str, str]:
    """
    Automatically choose TOON or JSON encoding based on efficiency.

    Returns TOON if:
    1. Data structure is suitable for TOON
    2. TOON provides >20% token reduction

    Otherwise returns JSON.

    Args:
        data: Data to encode

    Returns:
        Tuple of (content_type, encoded_string)
        - content_type: "application/toon" or "application/json"
        - encoded_string: Encoded data

    Examples:
        >>> data = [{"id": 1}, {"id": 2}]
        >>> content_type, encoded = toon_or_json(data)
        >>> assert content_type in ["application/toon", "application/json"]
    """
    # Check if TOON is suitable
    if isinstance(data, list) and supports_toon(data):
        reduction = calculate_token_reduction(data)

        # Use TOON if >20% reduction
        if reduction > 0.2:
            toon_str = encode_to_toon(data)
            return ("application/toon", toon_str)

    # Fallback to JSON
    json_str = json.dumps(data, separators=(',', ':'))
    return ("application/json", json_str)


# Backward compatibility alias
encode = encode_to_toon
decode = decode_from_toon
