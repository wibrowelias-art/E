/*
 * Icon set: lucide (open source, ISC). Re-exported under the app's own names so
 * components stay readable. Only the tiny animated "speaking" equaliser is drawn here.
 */
import type { SVGProps } from "react";
import {
  ArrowLeft as LArrowLeft,
  AtSign,
  Bell,
  BellOff,
  BookOpen,
  Check,
  ChevronDown as LChevronDown,
  ChevronLeft as LChevronLeft,
  ChevronRight as LChevronRight,
  CircleDashed,
  CirclePlus,
  Compass,
  Copy,
  Crown,
  EyeOff,
  Globe,
  Hash,
  Headphones,
  HeadphoneOff,
  Image as LImage,
  Inbox,
  Keyboard,
  Link2,
  Lock,
  MessageCircle,
  MessageSquareText,
  Mic,
  MicOff,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Pin,
  Plus,
  Reply,
  Search,
  SendHorizontal,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Smile,
  SmilePlus,
  Sparkles,
  Sticker,
  Trash2,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  X,
  CircleHelp,
  ArrowDown,
  CheckCheck,
  Film,
  type LucideProps,
} from "lucide-react";

type P = LucideProps;
const mk = (Icon: React.ComponentType<LucideProps>, defSize: number, defStroke = 2) =>
  function LoungeIcon({ size = defSize, strokeWidth = defStroke, ...p }: P) {
    return <Icon size={size} strokeWidth={strokeWidth} aria-hidden focusable={false} {...p} />;
  };

export const HashIcon = mk(Hash, 20, 2);
export const SpeakerIcon = mk(Volume2, 20, 2);
export const SpeakerOffIcon = mk(VolumeX, 20, 2);
export const LockIcon = mk(Lock, 20, 2);
export const ChevronDown = mk(LChevronDown, 16, 2);
export const ChevronRight = mk(LChevronRight, 16, 2);
export const ChevronLeft = mk(LChevronLeft, 24, 2);
export const ArrowLeft = mk(LArrowLeft, 24, 2);
export const ArrowDownIcon = mk(ArrowDown, 16, 2.2);
export const SearchIcon = mk(Search, 20, 2);
export const BubbleIcon = mk(MessageCircle, 24, 2);
export const PlusCircleFill = mk(CirclePlus, 24, 2);
export const PlusIcon = mk(Plus, 24, 2.2);
export const InviteIcon = mk(UserPlus, 24, 2);
export const BellIcon = mk(Bell, 24, 2);
export const BellOffIcon = mk(BellOff, 24, 2);
export const DottedCircle = mk(CircleDashed, 16, 2);
export const MicIcon = mk(Mic, 20, 2);
export const MicOffIcon = mk(MicOff, 20, 2);
export const HeadphonesIcon = mk(Headphones, 20, 2);
export const HeadphonesOffIcon = mk(HeadphoneOff, 20, 2);
export const GearIcon = mk(Settings, 20, 2);
export const ThreadsIcon = mk(MessageSquareText, 24, 2);
export const PinIcon = mk(Pin, 24, 2);
export const MembersIcon = mk(Users, 24, 2);
export const InboxIcon = mk(Inbox, 24, 2);
export const HelpIcon = mk(CircleHelp, 24, 2);
export const GifIcon = mk(Film, 24, 2);
export const StickerIcon = mk(Sticker, 24, 2);
export const EmojiIcon = mk(Smile, 24, 2);
export const EmojiFillIcon = mk(Smile, 24, 2);
export const ReactIcon = mk(SmilePlus, 20, 2);
export const ReplyIcon = mk(Reply, 20, 2);
export const EditIcon = mk(Pencil, 20, 2);
export const MoreIcon = mk(MoreHorizontal, 20, 2);
export const CrownIcon = mk(Crown, 14, 2.2);
export const CloseIcon = mk(X, 20, 2);
export const CompassIcon = mk(Compass, 24, 2);
export const BadgeFlower = mk(ShieldCheck, 20, 2);
export const SendIcon = mk(SendHorizontal, 24, 2);
export const SlidersIcon = mk(SlidersHorizontal, 20, 2);
export const GlobeIcon = mk(Globe, 20, 2);
export const CheckIcon = mk(Check, 16, 2.4);
export const CheckAllIcon = mk(CheckCheck, 18, 2);
export const CopyIcon = mk(Copy, 18, 2);
export const LinkIcon = mk(Link2, 18, 2);
export const TrashIcon = mk(Trash2, 18, 2);
export const AtIcon = mk(AtSign, 18, 2);
export const ImageIcon = mk(LImage, 20, 2);
export const PaperclipIcon = mk(Paperclip, 20, 2);
export const SpoilerIcon = mk(EyeOff, 18, 2);
export const KeyboardIcon = mk(Keyboard, 18, 2);
export const SparklesIcon = mk(Sparkles, 18, 2);
export const RulesIcon = mk(BookOpen, 20, 2);

/** Animated "speaking" bars (own drawing). */
export const StageWaveIcon = ({ size = 14, ...p }: SVGProps<SVGSVGElement> & { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden focusable={false} {...p}>
    <rect className="wave-bar wave-bar-1" x="1" y="4" width="2" height="6" rx="1" fill="currentColor" />
    <rect className="wave-bar wave-bar-2" x="6" y="2" width="2" height="10" rx="1" fill="currentColor" />
    <rect className="wave-bar wave-bar-3" x="11" y="5" width="2" height="4" rx="1" fill="currentColor" />
  </svg>
);
