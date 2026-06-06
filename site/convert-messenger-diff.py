"""
Convert Facebook Messenger HTML diff exports to JSON format matching the original export structure.
Place HTML diff folders in source-materials/messenger/diff/
Run this script to merge them into the existing JSON message files.
"""
import re
import json
from pathlib import Path
from datetime import datetime
from html.parser import HTMLParser

DIFF_DIR = Path(__file__).parent.parent / 'source-materials' / 'messenger' / 'diff'
MESSENGER_DIR = Path(__file__).parent.parent / 'source-materials' / 'messenger'

class MessageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.messages = []
        self.current_msg = None
        self.in_sender = False
        self.in_body = False
        self.in_footer = False
        self.in_reaction = False
        self.capture = ''
        self.tag_stack = []
    
    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        cls = attrs_dict.get('class', '')
        
        # Sender name (h2 with _a6-h class inside section)
        if tag == 'h2' and '_a6-h' in cls:
            self.current_msg = {'sender_name': '', 'content': '', 'photos': [], 'videos': [], 'audio': [], 'reactions': [], 'timestamp_ms': 0}
            self.in_sender = True
            self.capture = ''
        
        # Message body div
        if tag == 'div' and '_a6-p' in cls and self.current_msg:
            self.in_body = True
            self.capture = ''
        
        # Footer with timestamp
        if tag == 'footer' and self.current_msg:
            self.in_footer = True
            self.capture = ''
        
        # Reactions
        if tag == 'ul' and '_a6-q' in cls:
            self.in_reaction = True
        
        if tag == 'span' and self.in_reaction:
            self.capture = ''
        
        # Photos
        if tag == 'img' and self.current_msg and 'src' in attrs_dict:
            src = attrs_dict['src']
            if 'photos/' in src:
                filename = src.split('/')[-1]
                self.current_msg['photos'].append(filename)
        
        # Videos
        if tag == 'video' and self.current_msg and 'src' in attrs_dict:
            src = attrs_dict['src']
            if 'videos/' in src:
                filename = src.split('/')[-1]
                self.current_msg['videos'].append(filename)
        
        # Audio
        if tag == 'audio' and self.current_msg and 'src' in attrs_dict:
            src = attrs_dict['src']
            if 'audio/' in src:
                filename = src.split('/')[-1]
                self.current_msg['audio'].append(filename)
    
    def handle_endtag(self, tag):
        if tag == 'h2' and self.in_sender:
            self.in_sender = False
            if self.current_msg:
                self.current_msg['sender_name'] = self.capture.strip()
        
        if tag == 'footer' and self.in_footer:
            self.in_footer = False
            # Parse timestamp
            if self.current_msg and self.capture.strip():
                try:
                    dt = datetime.strptime(self.capture.strip(), '%b %d, %Y %I:%M:%S %p')
                    self.current_msg['timestamp_ms'] = int(dt.timestamp() * 1000)
                except:
                    pass
            if self.current_msg and self.current_msg['timestamp_ms']:
                self.messages.append(self.current_msg)
            self.current_msg = None
        
        if tag == 'div' and self.in_body:
            self.in_body = False
            if self.current_msg and self.capture.strip():
                self.current_msg['content'] = self.capture.strip()
        
        if tag == 'ul' and self.in_reaction:
            self.in_reaction = False
        
        if tag == 'span' and self.in_reaction and self.current_msg:
            text = self.capture.strip()
            if text:
                # Format: "❤Tanya Killian" or "👍Spencer Killian"
                reaction = text[0] if text else ''
                actor = text[1:].strip() if len(text) > 1 else ''
                if actor:
                    self.current_msg['reactions'].append({'reaction': reaction, 'actor': actor})
    
    def handle_data(self, data):
        if self.in_sender or self.in_footer or self.in_reaction:
            self.capture += data
        elif self.in_body and self.current_msg:
            self.capture += data


def convert_diff(diff_folder):
    html_file = diff_folder / 'message_1.html'
    if not html_file.exists():
        return []
    
    parser = MessageParser()
    parser.feed(html_file.read_text(encoding='utf-8'))
    
    # Convert to standard format
    messages = []
    for msg in parser.messages:
        entry = {
            'sender_name': msg['sender_name'],
            'timestamp_ms': msg['timestamp_ms'],
            'is_geoblocked_for_viewer': False,
        }
        if msg['content']:
            entry['content'] = msg['content']
        if msg['photos']:
            entry['photos'] = [{'uri': f'messages/inbox/{diff_folder.name}/photos/{p}'} for p in msg['photos']]
        if msg['videos']:
            entry['videos'] = [{'uri': f'messages/inbox/{diff_folder.name}/videos/{v}'} for v in msg['videos']]
        if msg['audio']:
            entry['audio_files'] = [{'uri': f'messages/inbox/{diff_folder.name}/audio/{a}'} for a in msg['audio']]
        if msg['reactions']:
            entry['reactions'] = msg['reactions']
        messages.append(entry)
    
    return messages


def merge_messages(existing_json_path, new_messages):
    """Merge new messages into existing JSON, deduplicating by timestamp+sender."""
    if existing_json_path.exists():
        data = json.loads(existing_json_path.read_text(encoding='utf-8'))
    else:
        data = {'participants': [], 'messages': [], 'title': '', 'is_still_participant': True}
    
    existing_keys = set((m['sender_name'], m['timestamp_ms']) for m in data['messages'])
    added = 0
    for msg in new_messages:
        key = (msg['sender_name'], msg['timestamp_ms'])
        if key not in existing_keys:
            data['messages'].append(msg)
            added += 1
    
    # Sort by timestamp descending (newest first)
    data['messages'].sort(key=lambda m: m['timestamp_ms'], reverse=True)
    return data, added


if __name__ == '__main__':
    if not DIFF_DIR.exists():
        print("No diff directory found")
        exit(1)
    
    for folder in sorted(DIFF_DIR.iterdir()):
        if not folder.is_dir():
            continue
        print(f"\nProcessing: {folder.name}")
        
        new_messages = convert_diff(folder)
        print(f"  Parsed {len(new_messages)} messages from HTML")
        
        # Find matching existing JSON
        existing_folder = MESSENGER_DIR / folder.name
        existing_json = existing_folder / 'message_1.json'
        
        if not existing_folder.exists():
            existing_folder.mkdir(parents=True)
        
        data, added = merge_messages(existing_json, new_messages)
        
        # Copy media files
        for subdir in ['photos', 'videos', 'audio']:
            src_dir = folder / subdir
            dst_dir = existing_folder / subdir
            if src_dir.exists():
                dst_dir.mkdir(exist_ok=True)
                for f in src_dir.iterdir():
                    dst = dst_dir / f.name
                    if not dst.exists():
                        import shutil
                        shutil.copy2(f, dst)
        
        existing_json.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding='utf-8')
        print(f"  Added {added} new messages (total: {len(data['messages'])})")
