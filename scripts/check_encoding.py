import os
import sys
import re

# Known corruption patterns
CORRUPTION_PATTERNS = [
    r'[a-zA-Z]+ềE',
    r'[a-zA-Z]+āE',
    r'E/span>',
    r'E/div>',
    r'E/button>',
    r'E/option>',
    r'E/label>'
]

def check_file(filepath):
    errors = []
    # Skip the encoding guide itself as it contains examples
    if "encoding-guide.md" in filepath:
        return errors

    try:
        with open(filepath, 'rb') as f:
            raw = f.read()
            raw.decode('utf-8')
    except UnicodeDecodeError as e:
        errors.append(f"Invalid UTF-8 encoding at position {e.start}")
        return errors

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            for pattern in CORRUPTION_PATTERNS:
                if re.search(pattern, content):
                    errors.append(f"Found corruption pattern: {pattern}")
    except Exception as e:
        errors.append(f"Error reading file: {str(e)}")

    return errors

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    target_dirs = ['mini-app', 'supabase', 'docs']
    extensions = ['.html', '.js', '.ts', '.md']
    
    found_errors = False
    print(f"Checking files in {base_dir}...")

    for target in target_dirs:
        dir_path = os.path.join(base_dir, target)
        if not os.path.exists(dir_path):
            continue
            
        for root, _, files in os.walk(dir_path):
            for file in files:
                if any(file.endswith(ext) for ext in extensions):
                    filepath = os.path.join(root, file)
                    errors = check_file(filepath)
                    if errors:
                        found_errors = True
                        rel_path = os.path.relpath(filepath, base_dir)
                        # Avoid print encoding issues on Windows console
                        print(f"\n[!] {rel_path}")
                        for err in errors:
                            print(f"    - Found issue (hidden to avoid console error)")

    if not found_errors:
        print("\n[OK] No encoding issues found.")
    else:
        print("\n[FAIL] Some files have encoding issues.")
        sys.exit(1)

if __name__ == "__main__":
    main()
