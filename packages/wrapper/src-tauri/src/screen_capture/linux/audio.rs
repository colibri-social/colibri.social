use std::cell::RefCell;
use std::collections::{HashMap, HashSet};
use std::rc::{Rc, Weak};
use std::sync::mpsc;
use std::thread::JoinHandle;
use std::time::Duration;

use crate::native_error::NativeError;
use crate::screen_capture::{matches_router, AudioApp, CaptureMessage, FrameSender, SourceKind};
use pipewire as pw;
use pw::properties::properties;
use pw::spa;
use pw::types::ObjectType;

pub const MAX_CHANNELS: usize = 2;
const SAMPLE_RATE: u32 = 48_000;
const SAMPLE_BYTES: usize = std::mem::size_of::<f32>();
const OUTPUT_STREAM_CLASS: &str = "Stream/Output/Audio";
const STREAM_NAME: &str = "colibri-screen-share-audio";
const LINK_FACTORY: &str = "link-factory";
const STARTUP_TIMEOUT: Duration = Duration::from_secs(5);
const LIST_TIMEOUT: Duration = Duration::from_secs(5);
const ANCESTRY_LIMIT: usize = 64;
const PROCESS_PREFIX: &str = "process";
const NAME_PREFIX: &str = "name";
const DESKTOP_PREFIX: &str = "desktop";
const DESKTOP_SUFFIX: &str = ".desktop";
const BINARY_SUFFIX: &str = "-bin";
const SHORTEST_APP_SEGMENT: usize = 3;

const LEFT_CHANNELS: &[&str] = &[
    "FL", "SL", "RL", "FLC", "RLC", "FLW", "FLH", "TFL", "TSL", "TRL", "BLC",
];
const RIGHT_CHANNELS: &[&str] = &[
    "FR", "SR", "RR", "FRC", "RRC", "FRW", "FRH", "TFR", "TSR", "TRR", "BRC",
];
const SILENT_CHANNELS: &[&str] = &["LFE", "LFE2", "LLFE", "RLFE"];

const ROUTER_APPS: &[&str] = &[
    "pw-loopback",
    "easyeffects",
    "easy effects",
    "com.github.wwmm.easyeffects",
    "carla",
];
const ROUTER_NODES: &[&str] = &[
    "output.loopback",
    "loopback-",
    "output.pw-loopback",
    "pw-loopback",
    "easyeffects",
    "ee_",
    "carla",
];

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum AppKey {
    Process(u32),
    Name(String),
    Desktop(String),
}

impl AppKey {
    pub fn encode(&self) -> String {
        match self {
            AppKey::Process(pid) => format!("{PROCESS_PREFIX}-{pid}"),
            AppKey::Name(name) => format!("{NAME_PREFIX}-{name}"),
            AppKey::Desktop(id) => format!("{DESKTOP_PREFIX}-{id}"),
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        let (prefix, rest) = value.split_once('-')?;
        if rest.is_empty() {
            return None;
        }
        match prefix {
            PROCESS_PREFIX => rest.parse().ok().map(AppKey::Process),
            NAME_PREFIX => Some(AppKey::Name(rest.to_string())),
            DESKTOP_PREFIX => desktop_id(rest).map(AppKey::Desktop),
            _ => None,
        }
    }

    fn matches(&self, node: &OutputNode, parent: &impl Fn(u32) -> Option<u32>) -> bool {
        match self {
            AppKey::Process(root) => node
                .process_id
                .is_some_and(|pid| descends_from(pid, *root, parent)),
            AppKey::Name(name) => node.process_id.is_none() && node.name == *name,
            AppKey::Desktop(id) => node.belongs_to(id),
        }
    }
}

pub fn desktop_id(value: &str) -> Option<String> {
    let trimmed = value.trim();
    let id = trimmed.strip_suffix(DESKTOP_SUFFIX).unwrap_or(trimmed);
    let valid = !id.is_empty()
        && !id.contains(':')
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_'));
    valid.then(|| id.to_string())
}

fn short_name(id: &str) -> Option<String> {
    id.rsplit('.')
        .next()
        .map(str::to_lowercase)
        .filter(|segment| segment.len() >= SHORTEST_APP_SEGMENT)
}

fn binary_name(binary: &str) -> String {
    let file = binary.rsplit('/').next().unwrap_or(binary).to_lowercase();
    match file.strip_suffix(BINARY_SUFFIX) {
        Some(stem) if !stem.is_empty() => stem.to_string(),
        _ => file,
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Shared {
    pub requested: SourceKind,
    pub kind: SourceKind,
    pub window_process: Option<u32>,
    pub window_app: Option<String>,
}

impl Shared {
    pub fn native(kind: SourceKind, window_process: Option<u32>) -> Self {
        Self {
            requested: kind,
            kind,
            window_process,
            window_app: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Target {
    Apps(Vec<AppKey>),
    EverythingExceptColibri,
}

impl Target {
    pub fn process_tree(pid: u32) -> Self {
        Target::Apps(vec![AppKey::Process(pid)])
    }

    pub fn from_ids(ids: &[String]) -> Option<Self> {
        let keys: Vec<AppKey> = ids.iter().filter_map(|id| AppKey::parse(id)).collect();
        (!keys.is_empty()).then_some(Target::Apps(keys))
    }

    fn wants(&self, node: &OutputNode, colibri: u32, parent: &impl Fn(u32) -> Option<u32>) -> bool {
        if node
            .process_id
            .is_some_and(|pid| descends_from(pid, colibri, parent))
        {
            return false;
        }
        match self {
            Target::EverythingExceptColibri => true,
            Target::Apps(keys) => keys.iter().any(|key| key.matches(node, parent)),
        }
    }
}

fn whole_screen(kind: SourceKind) -> bool {
    matches!(kind, SourceKind::Display)
}

pub fn choose_target(shared: &Shared, chosen: Option<&[String]>) -> Option<Target> {
    let chosen = chosen.filter(|_| !whole_screen(shared.requested) || whole_screen(shared.kind));
    if let Some(ids) = chosen {
        return Target::from_ids(ids);
    }
    match shared.kind {
        SourceKind::Display => Some(Target::EverythingExceptColibri),
        SourceKind::Window | SourceKind::Application => {
            shared.window_process.map(Target::process_tree).or_else(|| {
                shared
                    .window_app
                    .as_deref()
                    .and_then(desktop_id)
                    .map(|id| Target::Apps(vec![AppKey::Desktop(id)]))
            })
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct OutputNode {
    process_id: Option<u32>,
    name: String,
    node_name: Option<String>,
    icon_name: Option<String>,
    binary: Option<String>,
    application_id: Option<String>,
    sandbox_app_id: Option<String>,
}

impl OutputNode {
    fn from_props<'a>(get: impl Fn(&str) -> Option<&'a str>) -> Option<Self> {
        if get("media.class")? != OUTPUT_STREAM_CLASS {
            return None;
        }
        let present = |key: &str| get(key).map(str::trim).filter(|value| !value.is_empty());
        let binary = present("application.process.binary").map(str::to_string);
        let name = present("application.name")
            .or_else(|| present("node.description"))
            .or(binary.as_deref())
            .or_else(|| present("node.name"))?
            .to_string();

        Some(Self {
            process_id: present("application.process.id").and_then(|pid| pid.parse().ok()),
            name,
            node_name: present("node.name").map(str::to_string),
            icon_name: present("application.icon_name")
                .or_else(|| present("application.icon-name"))
                .map(str::to_string),
            binary,
            application_id: present("application.id").map(str::to_string),
            sandbox_app_id: present("pipewire.access.portal.app_id").map(str::to_string),
        })
    }

    fn belongs_to(&self, desktop: &str) -> bool {
        let wanted = desktop.to_lowercase();
        let ids = [
            self.application_id.as_deref(),
            self.sandbox_app_id.as_deref(),
        ];
        if ids
            .iter()
            .flatten()
            .any(|id| desktop_id(id).is_some_and(|id| id.to_lowercase() == wanted))
        {
            return true;
        }
        let Some(short) = short_name(&wanted) else {
            return false;
        };
        self.binary.as_deref().map(binary_name).as_deref() == Some(short.as_str())
            || self.name.to_lowercase() == short
            || self
                .application_id
                .as_deref()
                .map(str::to_lowercase)
                .as_deref()
                == Some(short.as_str())
    }

    fn is_router(&self) -> bool {
        self.node_name
            .as_deref()
            .is_some_and(|name| matches_router(name, ROUTER_NODES))
            || self
                .binary
                .as_deref()
                .is_some_and(|binary| matches_router(binary, ROUTER_APPS))
            || matches_router(&self.name, ROUTER_APPS)
    }

    fn key(&self) -> AppKey {
        match self.process_id {
            Some(pid) => AppKey::Process(pid),
            None => AppKey::Name(self.name.clone()),
        }
    }
}

type Props = HashMap<String, String>;

const NODE_KEYS: &[&str] = &[
    "media.class",
    "client.id",
    "node.name",
    "node.description",
    "application.name",
    "application.process.id",
    "application.process.binary",
    "application.icon_name",
    "application.icon-name",
    "application.id",
    "pipewire.access.portal.app_id",
];
const CLIENT_KEYS: &[&str] = &[
    "application.name",
    "application.process.id",
    "application.process.binary",
    "application.icon_name",
    "application.icon-name",
    "application.id",
    "pipewire.access.portal.app_id",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Probed {
    Node,
    Client,
}

#[derive(Default)]
struct Catalog {
    nodes: HashMap<u32, Props>,
    clients: HashMap<u32, Props>,
}

impl Catalog {
    fn insert(&mut self, kind: Probed, id: u32, props: Props) -> Vec<u32> {
        match kind {
            Probed::Node => {
                self.nodes.entry(id).or_default().extend(props);
                vec![id]
            }
            Probed::Client => {
                self.clients.entry(id).or_default().extend(props);
                let client = id.to_string();
                self.nodes
                    .iter()
                    .filter(|(_, node)| node.get("client.id") == Some(&client))
                    .map(|(node, _)| *node)
                    .collect()
            }
        }
    }

    fn remove(&mut self, id: u32) {
        self.nodes.remove(&id);
        self.clients.remove(&id);
    }

    fn resolve(&self, id: u32) -> Option<OutputNode> {
        let node = self.nodes.get(&id)?;
        let client = node
            .get("client.id")
            .and_then(|client| client.parse::<u32>().ok())
            .and_then(|client| self.clients.get(&client));
        OutputNode::from_props(|key| {
            node.get(key)
                .or_else(|| client.and_then(|client| client.get(key)))
                .map(String::as_str)
        })
    }

    fn output_nodes(&self) -> Vec<OutputNode> {
        self.nodes
            .keys()
            .filter_map(|id| self.resolve(*id))
            .collect()
    }
}

fn copy_props(dict: &spa::utils::dict::DictRef, keys: &[&str]) -> Props {
    keys.iter()
        .filter_map(|key| Some((key.to_string(), dict.get(key)?.to_string())))
        .collect()
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct PortInfo {
    node: u32,
    output: bool,
    channel: Option<String>,
}

impl PortInfo {
    fn from_props<'a>(get: impl Fn(&str) -> Option<&'a str>) -> Option<Self> {
        if get("port.monitor") == Some("true") {
            return None;
        }
        Some(Self {
            node: get("node.id")?.parse().ok()?,
            output: match get("port.direction")? {
                "out" => true,
                "in" => false,
                _ => return None,
            },
            channel: get("audio.channel").map(str::to_string),
        })
    }
}

fn parse_parent(stat: &str) -> Option<u32> {
    let (_, rest) = stat.rsplit_once(')')?;
    rest.split_whitespace().nth(1)?.parse().ok()
}

fn parent_process(pid: u32) -> Option<u32> {
    parse_parent(&std::fs::read_to_string(format!("/proc/{pid}/stat")).ok()?)
}

fn descends_from(pid: u32, ancestor: u32, parent: &impl Fn(u32) -> Option<u32>) -> bool {
    let mut current = pid;
    for _ in 0..ANCESTRY_LIMIT {
        if current == ancestor {
            return true;
        }
        if current <= 1 {
            return false;
        }
        match parent(current) {
            Some(next) if next != current => current = next,
            _ => return false,
        }
    }
    false
}

fn sides(channel: Option<&str>) -> (bool, bool) {
    match channel {
        Some(name) if SILENT_CHANNELS.contains(&name) => (false, false),
        Some(name) if LEFT_CHANNELS.contains(&name) => (true, false),
        Some(name) if RIGHT_CHANNELS.contains(&name) => (false, true),
        _ => (true, true),
    }
}

fn planar(interleaved: &[u8]) -> Option<CaptureMessage> {
    let frame_bytes = MAX_CHANNELS * SAMPLE_BYTES;
    let frames = interleaved.len() / frame_bytes;
    if frames == 0 {
        return None;
    }

    let mut data = Vec::with_capacity(frames * frame_bytes);
    for channel in 0..MAX_CHANNELS {
        for frame in 0..frames {
            let offset = frame * frame_bytes + channel * SAMPLE_BYTES;
            data.extend_from_slice(&interleaved[offset..offset + SAMPLE_BYTES]);
        }
    }

    Some(CaptureMessage::Audio {
        channels: MAX_CHANNELS as u8,
        frames: frames as u32,
        data,
    })
}

#[derive(Default)]
struct Graph {
    wanted: HashSet<u32>,
    ports: HashMap<u32, PortInfo>,
    own_node: Option<u32>,
}

impl Graph {
    fn remove(&mut self, id: u32) {
        self.wanted.remove(&id);
        self.ports.remove(&id);
        if self.own_node == Some(id) {
            self.own_node = None;
        }
    }

    fn own_input(&self, channel: &str) -> Option<u32> {
        let own = self.own_node?;
        self.ports
            .iter()
            .find(|(_, port)| {
                port.node == own && !port.output && port.channel.as_deref() == Some(channel)
            })
            .map(|(id, _)| *id)
    }

    fn wanted_links(&self) -> HashSet<(u32, u32)> {
        let mut links = HashSet::new();
        let (Some(left), Some(right)) = (self.own_input("FL"), self.own_input("FR")) else {
            return links;
        };

        for (id, port) in &self.ports {
            if !port.output || !self.wanted.contains(&port.node) {
                continue;
            }
            let (to_left, to_right) = sides(port.channel.as_deref());
            if to_left {
                links.insert((*id, left));
            }
            if to_right {
                links.insert((*id, right));
            }
        }
        links
    }
}

struct Session {
    target: Target,
    colibri: u32,
    core: pw::core::CoreRc,
    registry: pw::registry::RegistryRc,
    graph: Graph,
    catalog: Catalog,
    probes: HashMap<u32, Probe>,
    links: HashMap<(u32, u32), pw::link::Link>,
}

impl Session {
    fn reconcile(&mut self) {
        let wanted = self.graph.wanted_links();
        self.links.retain(|key, _| wanted.contains(key));

        for (output, input) in wanted {
            if self.links.contains_key(&(output, input)) {
                continue;
            }
            let (Some(from), Some(to)) = (
                self.graph.ports.get(&output).map(|port| port.node),
                self.graph.ports.get(&input).map(|port| port.node),
            ) else {
                continue;
            };
            let props = properties! {
                "link.output.node" => from.to_string(),
                "link.output.port" => output.to_string(),
                "link.input.node" => to.to_string(),
                "link.input.port" => input.to_string(),
            };
            if let Ok(link) = self
                .core
                .create_object::<pw::link::Link>(LINK_FACTORY, &props)
            {
                self.links.insert((output, input), link);
            }
        }
    }
}

enum Probe {
    Node {
        _proxy: pw::node::Node,
        _listener: pw::node::NodeListener,
    },
    Client {
        _proxy: pw::client::Client,
        _listener: pw::client::ClientListener,
    },
}

fn probe(
    registry: &pw::registry::RegistryRc,
    global: &pw::registry::GlobalObject<&spa::utils::dict::DictRef>,
    on_props: impl Fn(Probed, u32, Props) + 'static,
) -> Option<Probe> {
    let id = global.id;
    match global.type_ {
        ObjectType::Node => {
            let class = global.props.and_then(|props| props.get("media.class"));
            if class != Some(OUTPUT_STREAM_CLASS) {
                return None;
            }
            let node: pw::node::Node = registry.bind(global).ok()?;
            let listener = node
                .add_listener_local()
                .info(move |info| {
                    if let Some(props) = info.props() {
                        on_props(Probed::Node, id, copy_props(props, NODE_KEYS));
                    }
                })
                .register();
            Some(Probe::Node {
                _proxy: node,
                _listener: listener,
            })
        }
        ObjectType::Client => {
            let client: pw::client::Client = registry.bind(global).ok()?;
            let listener = client
                .add_listener_local()
                .info(move |info| {
                    if let Some(props) = info.props() {
                        on_props(Probed::Client, id, copy_props(props, CLIENT_KEYS));
                    }
                })
                .register();
            Some(Probe::Client {
                _proxy: client,
                _listener: listener,
            })
        }
        _ => None,
    }
}

fn format_param() -> Result<Vec<u8>, String> {
    let mut info = spa::param::audio::AudioInfoRaw::new();
    info.set_format(spa::param::audio::AudioFormat::F32LE);
    info.set_rate(SAMPLE_RATE);
    info.set_channels(MAX_CHANNELS as u32);
    let mut position = [0u32; spa::sys::SPA_AUDIO_MAX_CHANNELS as usize];
    position[0] = spa::sys::SPA_AUDIO_CHANNEL_FL;
    position[1] = spa::sys::SPA_AUDIO_CHANNEL_FR;
    info.set_position(position);

    let object = spa::pod::Object {
        type_: spa::utils::SpaTypes::ObjectParamFormat.as_raw(),
        id: spa::param::ParamType::EnumFormat.as_raw(),
        properties: info.into(),
    };
    spa::pod::serialize::PodSerializer::serialize(
        std::io::Cursor::new(Vec::new()),
        &spa::pod::Value::Object(object),
    )
    .map(|(cursor, _)| cursor.into_inner())
    .map_err(|error| format!("{error:?}"))
}

fn run_capture(
    target: Target,
    sender: FrameSender,
    quit: pw::channel::Receiver<()>,
    ready: &mpsc::Sender<Result<(), String>>,
) -> Result<(), String> {
    pw::init();
    let mainloop = pw::main_loop::MainLoopRc::new(None).map_err(|error| error.to_string())?;
    let context =
        pw::context::ContextRc::new(&mainloop, None).map_err(|error| error.to_string())?;
    let core = context
        .connect_rc(None)
        .map_err(|error| error.to_string())?;
    let registry = core.get_registry_rc().map_err(|error| error.to_string())?;

    let session = Rc::new(RefCell::new(Session {
        target,
        colibri: std::process::id(),
        core: core.clone(),
        registry: registry.clone(),
        graph: Graph::default(),
        catalog: Catalog::default(),
        probes: HashMap::new(),
        links: HashMap::new(),
    }));

    let stopper = mainloop.downgrade();
    let _quit = quit.attach(mainloop.loop_(), move |()| {
        if let Some(mainloop) = stopper.upgrade() {
            mainloop.quit();
        }
    });

    let stopper = mainloop.downgrade();
    let _core_listener = core
        .add_listener_local()
        .error(move |id, _seq, _res, _message| {
            if id == pw::core::PW_ID_CORE {
                if let Some(mainloop) = stopper.upgrade() {
                    mainloop.quit();
                }
            }
        })
        .register();

    let _registry_listener = registry
        .add_listener_local()
        .global({
            let weak = Rc::downgrade(&session);
            move |global| on_global(&weak, global)
        })
        .global_remove({
            let weak = Rc::downgrade(&session);
            move |id| {
                if let Some(session) = weak.upgrade() {
                    let mut session = session.borrow_mut();
                    session.probes.remove(&id);
                    session.catalog.remove(id);
                    session.graph.remove(id);
                    session.reconcile();
                }
            }
        })
        .register();

    let stream = pw::stream::StreamRc::new(
        core.clone(),
        STREAM_NAME,
        properties! {
            *pw::keys::MEDIA_TYPE => "Audio",
            *pw::keys::MEDIA_CATEGORY => "Capture",
            *pw::keys::MEDIA_ROLE => "Screen",
            *pw::keys::NODE_NAME => STREAM_NAME,
            *pw::keys::NODE_DESCRIPTION => "Colibri screen share audio",
            *pw::keys::APP_NAME => "Colibri",
            *pw::keys::NODE_AUTOCONNECT => "false",
            *pw::keys::NODE_DONT_RECONNECT => "true",
        },
    )
    .map_err(|error| error.to_string())?;

    let _stream_listener = stream
        .add_local_listener_with_user_data(sender)
        .state_changed({
            let weak = Rc::downgrade(&session);
            move |stream, _, _, state| {
                if !matches!(
                    state,
                    pw::stream::StreamState::Paused | pw::stream::StreamState::Streaming
                ) {
                    return;
                }
                if let Some(session) = weak.upgrade() {
                    let mut session = session.borrow_mut();
                    let id = stream.node_id();
                    if session.graph.own_node != Some(id) {
                        session.graph.own_node = Some(id);
                        session.reconcile();
                    }
                }
            }
        })
        .process(|stream, sender| {
            let Some(mut buffer) = stream.dequeue_buffer() else {
                return;
            };
            let Some(data) = buffer.datas_mut().first_mut() else {
                return;
            };
            let offset = data.chunk().offset() as usize;
            let size = data.chunk().size() as usize;
            let Some(bytes) = data.data() else {
                return;
            };
            let Some(samples) = bytes.get(offset..offset.saturating_add(size)) else {
                return;
            };
            if let Some(message) = planar(samples) {
                let _ = sender.send(message);
            }
        })
        .register()
        .map_err(|error| error.to_string())?;

    let format = format_param()?;
    let pod = spa::pod::Pod::from_bytes(&format).ok_or("the audio format did not serialise")?;
    stream
        .connect(
            spa::utils::Direction::Input,
            None,
            pw::stream::StreamFlags::MAP_BUFFERS,
            &mut [pod],
        )
        .map_err(|error| error.to_string())?;

    let _ = ready.send(Ok(()));
    mainloop.run();

    let _ = stream.disconnect();
    if let Ok(mut session) = session.try_borrow_mut() {
        session.links.clear();
        session.probes.clear();
    }
    Ok(())
}

fn on_global(
    weak: &Weak<RefCell<Session>>,
    global: &pw::registry::GlobalObject<&spa::utils::dict::DictRef>,
) {
    let Some(session) = weak.upgrade() else {
        return;
    };

    if global.type_ == ObjectType::Port {
        let Some(port) = global
            .props
            .and_then(|props| PortInfo::from_props(|key| props.get(key)))
        else {
            return;
        };
        let mut session = session.borrow_mut();
        session.graph.ports.insert(global.id, port);
        session.reconcile();
        return;
    }

    let registry = session.borrow().registry.clone();
    let handle = weak.clone();
    let probe = probe(&registry, global, move |kind, id, props| {
        let Some(session) = handle.upgrade() else {
            return;
        };
        let mut session = session.borrow_mut();
        let mut changed = false;
        for node in session.catalog.insert(kind, id, props) {
            let wanted = session.catalog.resolve(node).is_some_and(|found| {
                session
                    .target
                    .wants(&found, session.colibri, &parent_process)
            });
            changed |= if wanted {
                session.graph.wanted.insert(node)
            } else {
                session.graph.wanted.remove(&node)
            };
        }
        if changed {
            session.reconcile();
        }
    });
    if let Some(probe) = probe {
        session.borrow_mut().probes.insert(global.id, probe);
    }
}

pub struct Capture {
    quit: Option<pw::channel::Sender<()>>,
    worker: Option<JoinHandle<()>>,
}

impl Capture {
    pub fn stop(self) {
        drop(self);
    }
}

impl Drop for Capture {
    fn drop(&mut self) {
        if let Some(quit) = self.quit.take() {
            let _ = quit.send(());
        }
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }
}

pub fn start(target: Target, sender: FrameSender) -> Result<Capture, NativeError> {
    let (quit, quit_receiver) = pw::channel::channel::<()>();
    let (ready, started) = mpsc::channel::<Result<(), String>>();

    let worker = std::thread::Builder::new()
        .name("colibri-capture-audio".to_string())
        .spawn(move || {
            if let Err(message) = run_capture(target, sender, quit_receiver, &ready) {
                let _ = ready.send(Err(message));
            }
        })
        .map_err(|error| {
            NativeError::failed(format!("could not start capturing audio: {error}"))
        })?;

    let capture = Capture {
        quit: Some(quit),
        worker: Some(worker),
    };

    match started.recv_timeout(STARTUP_TIMEOUT) {
        Ok(Ok(())) => Ok(capture),
        Ok(Err(message)) => Err(NativeError::failed(format!(
            "could not capture that audio: {message}"
        ))),
        Err(_) => Err(NativeError::failed("the audio capture never started")),
    }
}

fn roundtrip(mainloop: &pw::main_loop::MainLoopRc, core: &pw::core::CoreRc) -> Result<(), String> {
    let done = Rc::new(std::cell::Cell::new(false));
    let pending = core.sync(0).map_err(|error| error.to_string())?;
    let flag = done.clone();
    let stopper = mainloop.downgrade();
    let _listener = core
        .add_listener_local()
        .done(move |id, seq| {
            if id == pw::core::PW_ID_CORE && seq == pending {
                flag.set(true);
                if let Some(mainloop) = stopper.upgrade() {
                    mainloop.quit();
                }
            }
        })
        .register();

    while !done.get() {
        mainloop.run();
    }
    Ok(())
}

fn output_nodes() -> Result<Vec<OutputNode>, String> {
    pw::init();
    let mainloop = pw::main_loop::MainLoopRc::new(None).map_err(|error| error.to_string())?;
    let context =
        pw::context::ContextRc::new(&mainloop, None).map_err(|error| error.to_string())?;
    let core = context
        .connect_rc(None)
        .map_err(|error| error.to_string())?;
    let registry = core.get_registry_rc().map_err(|error| error.to_string())?;

    let catalog: Rc<RefCell<Catalog>> = Rc::default();
    let probes: Rc<RefCell<Vec<Probe>>> = Rc::default();

    let _listener = registry
        .add_listener_local()
        .global({
            let registry = registry.clone();
            let catalog = Rc::downgrade(&catalog);
            let probes = Rc::downgrade(&probes);
            move |global| {
                let catalog = catalog.clone();
                let found = probe(&registry, global, move |kind, id, props| {
                    if let Some(catalog) = catalog.upgrade() {
                        catalog.borrow_mut().insert(kind, id, props);
                    }
                });
                if let (Some(found), Some(probes)) = (found, probes.upgrade()) {
                    probes.borrow_mut().push(found);
                }
            }
        })
        .register();

    roundtrip(&mainloop, &core)?;
    roundtrip(&mainloop, &core)?;

    probes.borrow_mut().clear();
    let nodes = catalog.borrow().output_nodes();
    Ok(nodes)
}

fn group_apps(
    nodes: &[OutputNode],
    colibri: u32,
    window_process_id: Option<u32>,
    parent: &impl Fn(u32) -> Option<u32>,
) -> Vec<AudioApp> {
    let visible: Vec<&OutputNode> = nodes
        .iter()
        .filter(|node| {
            !node
                .process_id
                .is_some_and(|pid| descends_from(pid, colibri, parent))
        })
        .collect();

    let processes: HashSet<u32> = visible.iter().filter_map(|node| node.process_id).collect();
    let root_of = |pid: u32| {
        let mut root = pid;
        let mut current = pid;
        for _ in 0..ANCESTRY_LIMIT {
            match parent(current) {
                Some(next) if next != current && next > 1 => {
                    current = next;
                    if processes.contains(&next) {
                        root = next;
                    }
                }
                _ => break,
            }
        }
        root
    };

    let mut apps: Vec<AudioApp> = Vec::new();
    let mut seen: HashSet<AppKey> = HashSet::new();
    let mut ordered = visible;
    ordered.sort_by_key(|node| node.process_id.is_some_and(|pid| pid != root_of(pid)));

    for node in ordered {
        let key = match node.key() {
            AppKey::Process(pid) => AppKey::Process(root_of(pid)),
            other => other,
        };
        let router = node.is_router();
        if !seen.insert(key.clone()) {
            let id = key.encode();
            if let Some(app) = apps.iter_mut().find(|app| app.id == id) {
                app.router |= router;
            }
            continue;
        }
        let process_id = match key {
            AppKey::Process(pid) => Some(pid),
            AppKey::Name(_) | AppKey::Desktop(_) => None,
        };
        let preselected = match (process_id, window_process_id) {
            (Some(pid), Some(window)) => {
                descends_from(pid, window, parent) || descends_from(window, pid, parent)
            }
            _ => false,
        };
        apps.push(AudioApp {
            id: key.encode(),
            name: node.name.clone(),
            process_id,
            icon_name: node.icon_name.clone(),
            binary: node.binary.clone(),
            preselected,
            router,
        });
    }

    apps.sort_by_key(|app| app.name.to_lowercase());
    apps
}

pub fn list_apps(window_process_id: Option<u32>) -> Result<Vec<AudioApp>, NativeError> {
    let (sender, receiver) = mpsc::channel();
    std::thread::Builder::new()
        .name("colibri-audio-apps".to_string())
        .spawn(move || {
            let _ = sender.send(output_nodes());
        })
        .map_err(|error| NativeError::failed(format!("could not list audio apps: {error}")))?;

    let nodes = match receiver.recv_timeout(LIST_TIMEOUT) {
        Ok(Ok(nodes)) => nodes,
        Ok(Err(message)) => {
            return Err(NativeError::failed(format!(
                "could not list audio apps: {message}"
            )))
        }
        Err(_) => return Err(NativeError::failed("listing audio apps timed out")),
    };

    Ok(group_apps(
        &nodes,
        std::process::id(),
        window_process_id,
        &parent_process,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tree(pairs: &[(u32, u32)]) -> impl Fn(u32) -> Option<u32> + '_ {
        move |pid| {
            pairs
                .iter()
                .find(|(child, _)| *child == pid)
                .map(|(_, parent)| *parent)
        }
    }

    fn node(pid: Option<u32>, name: &str) -> OutputNode {
        OutputNode {
            process_id: pid,
            name: name.to_string(),
            node_name: None,
            icon_name: None,
            binary: None,
            application_id: None,
            sandbox_app_id: None,
        }
    }

    fn portal(requested: SourceKind, kind: SourceKind, window_app: Option<&str>) -> Shared {
        Shared {
            requested,
            kind,
            window_process: None,
            window_app: window_app.map(str::to_string),
        }
    }

    fn ids(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    fn props<'a>(pairs: &'a [(&'a str, &'a str)]) -> impl Fn(&str) -> Option<&'a str> + 'a {
        move |key| {
            pairs
                .iter()
                .find(|(name, _)| *name == key)
                .map(|(_, value)| *value)
        }
    }

    fn samples(message: &CaptureMessage) -> Vec<f32> {
        let CaptureMessage::Audio { data, .. } = message else {
            panic!("audio messages carry audio");
        };
        data.chunks_exact(4)
            .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
            .collect()
    }

    #[test]
    fn a_native_client_lends_its_process_id_to_its_stream() {
        let mut catalog = Catalog::default();
        let props = |pairs: &[(&str, &str)]| -> Props {
            pairs
                .iter()
                .map(|(key, value)| (key.to_string(), value.to_string()))
                .collect()
        };

        let affected = catalog.insert(
            Probed::Node,
            162,
            props(&[
                ("media.class", "Stream/Output/Audio"),
                ("application.name", "pw-play"),
                ("client.id", "129"),
            ]),
        );
        assert_eq!(affected, vec![162]);
        assert_eq!(catalog.resolve(162).expect("resolves").process_id, None);

        let affected = catalog.insert(
            Probed::Client,
            129,
            props(&[
                ("application.name", "pw-cat"),
                ("application.process.id", "568622"),
            ]),
        );
        assert_eq!(affected, vec![162]);
        let found = catalog.resolve(162).expect("resolves");
        assert_eq!(found.process_id, Some(568622));
        assert_eq!(found.name, "pw-play");

        catalog.insert(Probed::Node, 162, Props::new());
        assert_eq!(catalog.resolve(162), Some(found));

        catalog.remove(162);
        assert!(catalog.output_nodes().is_empty());
    }

    #[test]
    fn an_app_key_survives_a_round_trip() {
        for key in [
            AppKey::Process(4242),
            AppKey::Name("Spotify-Free".to_string()),
            AppKey::Desktop("org.mozilla.firefox".to_string()),
        ] {
            assert_eq!(AppKey::parse(&key.encode()), Some(key));
        }
    }

    #[test]
    fn a_malformed_app_key_is_rejected() {
        for value in ["", "process", "process-", "process-abc", "nonsense-1", "-1"] {
            assert_eq!(AppKey::parse(value), None, "{value}");
        }
    }

    #[test]
    fn the_parent_is_read_past_a_process_name_with_spaces_and_parens() {
        let stat = "1234 (Web Content (x)) S 987 1234 1234 0 -1";
        assert_eq!(parse_parent(stat), Some(987));
    }

    #[test]
    fn a_child_process_descends_from_its_ancestors_only() {
        let parent = tree(&[(30, 20), (20, 10), (10, 1), (40, 1)]);
        assert!(descends_from(30, 10, &parent));
        assert!(descends_from(10, 10, &parent));
        assert!(!descends_from(40, 10, &parent));
        assert!(!descends_from(10, 30, &parent));
    }

    #[test]
    fn a_process_cycle_does_not_hang() {
        let parent = tree(&[(5, 6), (6, 5)]);
        assert!(!descends_from(5, 99, &parent));
    }

    #[test]
    fn an_output_stream_node_is_read_from_its_properties() {
        let found = OutputNode::from_props(props(&[
            ("media.class", "Stream/Output/Audio"),
            ("application.name", "Zen"),
            ("application.process.id", "371512"),
            ("application.process.binary", "zen-bin"),
            ("application.icon_name", "zen-browser"),
        ]))
        .expect("parses");

        assert_eq!(found.process_id, Some(371512));
        assert_eq!(found.name, "Zen");
        assert_eq!(found.icon_name.as_deref(), Some("zen-browser"));
        assert_eq!(found.binary.as_deref(), Some("zen-bin"));
    }

    #[test]
    fn an_unnamed_stream_falls_back_to_its_binary() {
        let found = OutputNode::from_props(props(&[
            ("media.class", "Stream/Output/Audio"),
            ("application.process.binary", "mpv"),
            ("node.name", "mpv"),
        ]))
        .expect("parses");
        assert_eq!(found.name, "mpv");
        assert_eq!(found.process_id, None);
    }

    #[test]
    fn microphones_and_sinks_are_not_output_streams() {
        for class in ["Stream/Input/Audio", "Audio/Sink", "Audio/Source"] {
            let found = OutputNode::from_props(props(&[
                ("media.class", class),
                ("application.name", "vesktop"),
            ]));
            assert_eq!(found, None, "{class}");
        }
    }

    #[test]
    fn monitor_ports_are_ignored() {
        let monitor = PortInfo::from_props(props(&[
            ("node.id", "7"),
            ("port.direction", "out"),
            ("port.monitor", "true"),
        ]));
        assert_eq!(monitor, None);

        let port = PortInfo::from_props(props(&[
            ("node.id", "7"),
            ("port.direction", "out"),
            ("audio.channel", "FL"),
        ]))
        .expect("parses");
        assert!(port.output);
        assert_eq!(port.channel.as_deref(), Some("FL"));
    }

    #[test]
    fn a_display_share_takes_every_app_except_colibri() {
        let parent = tree(&[(101, 100), (200, 1)]);
        let target = Target::EverythingExceptColibri;

        assert!(!target.wants(&node(Some(101), "Colibri"), 100, &parent));
        assert!(target.wants(&node(Some(200), "Zen"), 100, &parent));
        assert!(target.wants(&node(None, "Spotify"), 100, &parent));
    }

    #[test]
    fn an_app_share_takes_that_apps_process_tree() {
        let parent = tree(&[(301, 300), (300, 1), (200, 1)]);
        let target = Target::process_tree(300);

        assert!(target.wants(&node(Some(301), "Chromium"), 100, &parent));
        assert!(target.wants(&node(Some(300), "Chromium"), 100, &parent));
        assert!(!target.wants(&node(Some(200), "Zen"), 100, &parent));
    }

    #[test]
    fn a_sandboxed_app_without_a_process_id_is_chosen_by_name() {
        let parent = tree(&[]);
        let target = Target::from_ids(&["name-Spotify".to_string()]).expect("parses");

        assert!(target.wants(&node(None, "Spotify"), 100, &parent));
        assert!(!target.wants(&node(None, "Zen"), 100, &parent));
        assert!(!target.wants(&node(Some(5), "Spotify"), 100, &parent));
    }

    #[test]
    fn colibri_is_never_captured_even_when_chosen() {
        let parent = tree(&[(101, 100)]);
        let target = Target::process_tree(100);
        assert!(!target.wants(&node(Some(101), "Colibri"), 100, &parent));
    }

    #[test]
    fn the_target_follows_the_source_and_the_choice() {
        use SourceKind::{Display, Window};
        assert_eq!(
            choose_target(&Shared::native(Display, None), None),
            Some(Target::EverythingExceptColibri)
        );
        assert_eq!(
            choose_target(&Shared::native(Window, Some(42)), None),
            Some(Target::process_tree(42))
        );
        assert_eq!(choose_target(&Shared::native(Window, None), None), None);
        assert_eq!(
            choose_target(&Shared::native(Display, None), Some(&[])),
            None
        );
        assert_eq!(
            choose_target(
                &Shared::native(Window, Some(42)),
                Some(&ids(&["process-7", "name-Spotify"]))
            ),
            Some(Target::Apps(vec![
                AppKey::Process(7),
                AppKey::Name("Spotify".to_string())
            ]))
        );
    }

    #[test]
    fn a_portal_window_picked_from_the_screen_option_sends_no_audio() {
        use SourceKind::{Display, Window};
        assert_eq!(choose_target(&portal(Display, Window, None), None), None);
        assert_eq!(
            choose_target(
                &portal(Display, Window, None),
                Some(&ids(&["process-7", "process-8"]))
            ),
            None
        );
    }

    #[test]
    fn a_portal_window_with_a_known_app_takes_that_apps_audio() {
        use SourceKind::{Display, Window};
        let expected = Some(Target::Apps(vec![AppKey::Desktop(
            "org.mozilla.firefox".to_string(),
        )]));
        assert_eq!(
            choose_target(
                &portal(Display, Window, Some("org.mozilla.firefox.desktop")),
                None
            ),
            expected
        );
        assert_eq!(
            choose_target(
                &portal(Display, Window, Some("org.mozilla.firefox")),
                Some(&ids(&["process-7"]))
            ),
            expected
        );
        assert_eq!(
            choose_target(&portal(Window, Window, Some("org.mozilla.firefox")), None),
            expected
        );
    }

    #[test]
    fn an_app_chosen_for_the_window_wins_over_the_known_app() {
        use SourceKind::Window;
        assert_eq!(
            choose_target(
                &portal(Window, Window, Some("org.mozilla.firefox")),
                Some(&ids(&["name-Spotify"]))
            ),
            Some(Target::Apps(vec![AppKey::Name("Spotify".to_string())]))
        );
        assert_eq!(
            choose_target(
                &portal(Window, Window, Some("org.mozilla.firefox")),
                Some(&[])
            ),
            None
        );
    }

    #[test]
    fn an_unusable_window_app_id_sends_no_audio() {
        use SourceKind::{Display, Window};
        for app in ["", "  ", "window:12", ".desktop", "bad id"] {
            assert_eq!(
                choose_target(&portal(Display, Window, Some(app)), None),
                None,
                "{app}"
            );
        }
    }

    #[test]
    fn a_portal_screen_picked_from_the_window_option_keeps_the_chosen_app() {
        use SourceKind::{Display, Window};
        assert_eq!(
            choose_target(
                &portal(Window, Display, None),
                Some(&ids(&["name-Spotify"]))
            ),
            Some(Target::Apps(vec![AppKey::Name("Spotify".to_string())]))
        );
        assert_eq!(
            choose_target(&portal(Window, Display, None), Some(&[])),
            None
        );
    }

    #[test]
    fn an_x11_app_share_follows_its_process_tree() {
        assert_eq!(
            choose_target(&Shared::native(SourceKind::Application, Some(9)), None),
            Some(Target::process_tree(9))
        );
    }

    #[test]
    fn a_desktop_app_matches_its_sandbox_or_application_id() {
        let flatpak = OutputNode {
            sandbox_app_id: Some("org.mozilla.firefox".to_string()),
            ..node(Some(500), "Firefox Web Content")
        };
        let declared = OutputNode {
            application_id: Some("org.mozilla.Firefox".to_string()),
            ..node(None, "Something")
        };
        assert!(flatpak.belongs_to("org.mozilla.firefox"));
        assert!(declared.belongs_to("org.mozilla.firefox"));
    }

    #[test]
    fn a_desktop_app_matches_its_binary_or_name_by_the_last_segment() {
        let binary = OutputNode {
            binary: Some("/usr/lib/firefox/firefox-bin".to_string()),
            ..node(Some(500), "Web Content")
        };
        let named = node(Some(600), "Spotify");
        let plain = OutputNode {
            binary: Some("dolphin".to_string()),
            ..node(Some(700), "Dolphin")
        };
        assert!(binary.belongs_to("org.mozilla.firefox"));
        assert!(named.belongs_to("spotify"));
        assert!(plain.belongs_to("org.kde.dolphin"));
    }

    #[test]
    fn a_desktop_app_does_not_match_other_apps() {
        let zen = OutputNode {
            binary: Some("zen-bin".to_string()),
            sandbox_app_id: Some("app.zen_browser.zen".to_string()),
            ..node(Some(500), "Zen")
        };
        let chromium = OutputNode {
            binary: Some("chromium".to_string()),
            ..node(Some(600), "Chromium")
        };
        assert!(!zen.belongs_to("org.mozilla.firefox"));
        assert!(!chromium.belongs_to("org.mozilla.firefox"));
        assert!(!node(Some(1), "ab").belongs_to("ab"));
    }

    #[test]
    fn a_desktop_target_skips_colibri_and_other_apps() {
        let parent = tree(&[(101, 100)]);
        let target = Target::Apps(vec![AppKey::Desktop("org.mozilla.firefox".to_string())]);
        let firefox = OutputNode {
            binary: Some("firefox".to_string()),
            ..node(Some(500), "Firefox")
        };
        let colibri = OutputNode {
            binary: Some("firefox".to_string()),
            ..node(Some(101), "Firefox")
        };
        assert!(target.wants(&firefox, 100, &parent));
        assert!(!target.wants(&colibri, 100, &parent));
        assert!(!target.wants(&node(Some(200), "Zen"), 100, &parent));
    }

    #[test]
    fn channels_fold_into_stereo() {
        assert_eq!(sides(Some("FL")), (true, false));
        assert_eq!(sides(Some("RR")), (false, true));
        assert_eq!(sides(Some("MONO")), (true, true));
        assert_eq!(sides(Some("FC")), (true, true));
        assert_eq!(sides(None), (true, true));
        assert_eq!(sides(Some("LFE")), (false, false));
    }

    #[test]
    fn wanted_nodes_are_linked_into_the_matching_input() {
        let mut graph = Graph {
            own_node: Some(1),
            ..Graph::default()
        };
        let port = |node: u32, output: bool, channel: &str| PortInfo {
            node,
            output,
            channel: Some(channel.to_string()),
        };
        graph.ports.insert(10, port(1, false, "FL"));
        graph.ports.insert(11, port(1, false, "FR"));
        graph.ports.insert(20, port(2, true, "FL"));
        graph.ports.insert(21, port(2, true, "FR"));
        graph.ports.insert(30, port(3, true, "MONO"));
        graph.ports.insert(40, port(4, true, "FL"));
        graph.wanted.extend([2, 3]);

        let expected: HashSet<(u32, u32)> = [(20, 10), (21, 11), (30, 10), (30, 11)]
            .into_iter()
            .collect();
        assert_eq!(graph.wanted_links(), expected);

        graph.remove(3);
        let expected: HashSet<(u32, u32)> = [(20, 10), (21, 11)].into_iter().collect();
        assert_eq!(graph.wanted_links(), expected);
    }

    #[test]
    fn nothing_is_linked_before_the_capture_stream_has_ports() {
        let mut graph = Graph::default();
        graph.ports.insert(
            20,
            PortInfo {
                node: 2,
                output: true,
                channel: Some("FL".to_string()),
            },
        );
        graph.wanted.insert(2);
        assert!(graph.wanted_links().is_empty());
    }

    #[test]
    fn interleaved_stereo_is_split_into_one_plane_per_channel() {
        let mut interleaved = Vec::new();
        for frame in 0..3 {
            interleaved.extend_from_slice(&(frame as f32).to_le_bytes());
            interleaved.extend_from_slice(&(-(frame as f32)).to_le_bytes());
        }

        let message = planar(&interleaved).expect("converts");
        let CaptureMessage::Audio {
            channels, frames, ..
        } = &message
        else {
            panic!("audio messages carry audio");
        };
        assert_eq!((*channels, *frames), (2, 3));
        assert_eq!(samples(&message), vec![0.0, 1.0, 2.0, -0.0, -1.0, -2.0]);
    }

    #[test]
    fn a_partial_frame_is_dropped() {
        assert!(planar(&[0u8; 7]).is_none());
        let message = planar(&[0u8; 12]).expect("one whole frame");
        let CaptureMessage::Audio { frames, .. } = message else {
            panic!("audio messages carry audio");
        };
        assert_eq!(frames, 1);
    }

    #[test]
    fn apps_are_grouped_by_their_root_process_and_colibri_is_hidden() {
        let parent = tree(&[(101, 100), (301, 300), (300, 1), (200, 1)]);
        let nodes = vec![
            node(Some(101), "Colibri"),
            node(Some(301), "Chromium"),
            node(Some(300), "Chromium"),
            node(Some(200), "Zen"),
            node(None, "Spotify"),
            node(None, "Spotify"),
        ];

        let apps = group_apps(&nodes, 100, Some(300), &parent);
        let ids: Vec<&str> = apps.iter().map(|app| app.id.as_str()).collect();
        assert_eq!(ids, vec!["process-300", "name-Spotify", "process-200"]);
        assert!(apps[0].preselected);
        assert!(!apps[1].preselected);
        assert!(!apps[2].preselected);
    }

    #[test]
    fn a_window_owned_by_a_child_preselects_its_parent_app() {
        let parent = tree(&[(301, 300), (300, 1)]);
        let apps = group_apps(&[node(Some(300), "Chromium")], 100, Some(301), &parent);
        assert!(apps[0].preselected);
    }

    #[test]
    fn loopback_and_effect_nodes_are_flagged_as_routers() {
        let loopback = OutputNode {
            node_name: Some("output.loopback-1234-17".to_string()),
            ..node(Some(400), "PipeWire")
        };
        let effects = OutputNode {
            binary: Some("easyeffects".to_string()),
            ..node(Some(500), "Easy Effects")
        };
        let carla = node(None, "Carla");
        let firefox = OutputNode {
            node_name: Some("Firefox".to_string()),
            binary: Some("firefox".to_string()),
            ..node(Some(600), "Firefox")
        };

        assert!(loopback.is_router());
        assert!(effects.is_router());
        assert!(carla.is_router());
        assert!(!firefox.is_router());
    }

    #[test]
    fn a_group_is_a_router_when_any_of_its_streams_is_one() {
        let parent = tree(&[(401, 400), (400, 1), (600, 1)]);
        let nodes = vec![
            node(Some(400), "PipeWire"),
            OutputNode {
                node_name: Some("output.loopback-400-3".to_string()),
                ..node(Some(401), "PipeWire")
            },
            node(Some(600), "Firefox"),
        ];

        let apps = group_apps(&nodes, 100, None, &parent);
        let routers: Vec<(&str, bool)> = apps
            .iter()
            .map(|app| (app.id.as_str(), app.router))
            .collect();
        assert_eq!(routers, vec![("process-600", false), ("process-400", true)]);
    }
}
