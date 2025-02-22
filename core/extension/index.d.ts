/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// manually curated section
export function registerTool(t: typeof import("@itwin/core-frontend").Tool): Promise<void>
// these types are needed for ExtensionHost
import type {
	ToolAdmin,
	NotificationManager,
	ViewManager,
	ElementLocateManager,
	AccuSnap,
	RenderSystem
} from "@itwin/core-frontend";
// ExtensionHost must always be in the API
export declare class ExtensionHost {
	public static get toolAdmin(): ToolAdmin;
  public static get notifications(): NotificationManager;
  public static get viewManager(): ViewManager;
  public static get locateManager(): ElementLocateManager;
  public static get accuSnap(): AccuSnap;
  public static get renderSystem(): RenderSystem;
}

// BEGIN GENERATED CODE
export {
	ContextRotationId,
	ACSType,
	ACSDisplayOptions,
	CoordSystem,
	LocateAction,
	LocateFilterStatus,
	SnapStatus,
	FlashMode,
	FrontendLoggerCategory,
	SnapMode,
	SnapHeat,
	HitSource,
	HitGeomType,
	HitParentGeomType,
	HitPriority,
	HitDetailType,
	OutputMessageType,
	OutputMessagePriority,
	OutputMessageAlert,
	ActivityMessageEndReason,
	MessageBoxType,
	MessageBoxIconType,
	MessageBoxValue,
	GraphicType,
	UniformType,
	VaryingType,
	SelectionSetEventType,
	StandardViewId,
	TileLoadStatus,
	TileVisibility,
	TileLoadPriority,
	TileBoundingBoxes,
	TileTreeLoadStatus,
	TileGraphicType,
	ClipEventType,
	SelectionMethod,
	SelectionMode,
	SelectionProcessing,
	BeButton,
	CoordinateLockOverrides,
	InputSource,
	CoordSource,
	BeModifierKeys,
	EventHandled,
	ParseAndRunResult,
	KeyinParseError,
	StartOrResume,
	ManipulatorToolEvent,
	ToolAssistanceImage,
	ToolAssistanceInputMethod,
	ViewStatus,
	AccuDrawHintBuilder,
	AccuSnap,
	AuxCoordSystemState,
	AuxCoordSystem2dState,
	AuxCoordSystem3dState,
	AuxCoordSystemSpatialState,
	BingLocationProvider,
	CategorySelectorState,
	ChangeFlags,
	ContextRealityModelState,
	DisplayStyleState,
	DisplayStyle2dState,
	DisplayStyle3dState,
	DrawingViewState,
	LocateOptions,
	LocateResponse,
	ElementPicker,
	ElementLocateManager,
	EmphasizeElements,
	EntityState,
	ElementState,
	FlashSettings,
	FrustumAnimator,
	GlobeAnimator,
	HitDetail,
	SnapDetail,
	IntersectDetail,
	HitList,
	canvasToResizedCanvasWithBars,
	imageBufferToCanvas,
	canvasToImageBuffer,
	getImageSourceMimeType,
	getImageSourceFormatForMimeType,
	imageElementFromImageSource,
	imageElementFromUrl,
	extractImageSourceDimensions,
	imageBufferToPngDataUrl,
	imageBufferToBase64EncodedPng,
	getCompressedJpegFromCanvas,
	IModelConnection,
	NotificationHandler,
	MarginPercent,
	Marker,
	Cluster,
	MarkerSet,
	ModelSelectorState,
	ModelState,
	GeometricModelState,
	GeometricModel2dState,
	GeometricModel3dState,
	SheetModelState,
	SpatialModelState,
	PhysicalModelState,
	SpatialLocationModelState,
	DrawingModelState,
	SectionDrawingModelState,
	NotifyMessageDetails,
	ActivityMessageDetails,
	NotificationManager,
	PerModelCategoryVisibility,
	Decorations,
	FeatureSymbology,
	GraphicBranch,
	GraphicBuilder,
	Pixel,
	RenderClipVolume,
	RenderGraphic,
	RenderGraphicOwner,
	RenderSystem,
	Scene,
	HiliteSet,
	SelectionSet,
	SheetViewState,
	SpatialViewState,
	OrthographicViewState,
	Sprite,
	IconSprites,
	SpriteLocation,
	TentativePoint,
	DisclosedTileTreeSet,
	readElementGraphics,
	BingElevationProvider,
	Tile,
	TileAdmin,
	TileDrawArgs,
	TileRequest,
	TileRequestChannelStatistics,
	TileRequestChannel,
	TileRequestChannels,
	TileTree,
	TileTreeReference,
	TileUsageMarker,
	Tiles,
	ViewClipTool,
	ViewClipClearTool,
	ViewClipDecorationProvider,
	EditManipulator,
	EventController,
	PrimitiveTool,
	BeButtonState,
	BeButtonEvent,
	BeTouchEvent,
	BeWheelEvent,
	Tool,
	InteractiveTool,
	InputCollector,
	ToolAdmin,
	ToolAssistance,
	ToolSettings,
	ViewTool,
	ViewManip,
	ViewCreator2d,
	ViewCreator3d,
	queryTerrainElevationOffset,
	ViewingSpace,
	ViewManager,
	ViewPose,
	ViewRect,
	ViewState,
	ViewState3d,
	ViewState2d,
} from "@itwin/core-frontend";

export type {
	OsmBuildingDisplayOptions,
	HitListHolder,
	FeatureOverrideProvider,
	IModelIdArg,
	FuzzySearchResult,
	FrontendSecurityOptions,
	ToolTipOptions,
	CanvasDecoration,
	GraphicBranchOptions,
	BatchOptions,
	PickableGraphicOptions,
	GraphicBuilderOptions,
	ViewportGraphicBuilderOptions,
	ComputeChordToleranceArgs,
	CustomGraphicBuilderOptions,
	GraphicPrimitive2d,
	GraphicLineString,
	GraphicLineString2d,
	GraphicPointString,
	GraphicPointString2d,
	GraphicShape,
	GraphicShape2d,
	GraphicArc,
	GraphicArc2d,
	GraphicPath,
	GraphicLoop,
	GraphicPolyface,
	GraphicSolidPrimitive,
	ParticleCollectionBuilderParams,
	ParticleProps,
	ParticleCollectionBuilder,
	TextureCacheOwnership,
	TextureImage,
	CreateTextureArgs,
	CreateTextureFromSourceArgs,
	Uniform,
	UniformContext,
	UniformParams,
	UniformArrayParams,
	ScreenSpaceEffectSource,
	ScreenSpaceEffectBuilderParams,
	ScreenSpaceEffectContext,
	ScreenSpaceEffectBuilder,
	SelectAddEvent,
	SelectRemoveEvent,
	SelectReplaceEvent,
	TileTreeDiscloser,
	GpuMemoryLimits,
	TileContent,
	TiledGraphicsProvider,
	TileDrawArgParams,
	TileParams,
	TileTreeOwner,
	TileTreeParams,
	TileTreeSupplier,
	ViewClipEventHandler,
	BeButtonEventProps,
	BeTouchEventProps,
	BeWheelEventProps,
	ParseKeyinError,
	ParsedKeyin,
	ToolAssistanceKeyboardInfo,
	ToolAssistanceInstruction,
	ToolAssistanceSection,
	ToolAssistanceInstructions,
	Animator,
	ViewAnimationOptions,
	GlobalAlignmentOptions,
	OnViewExtentsError,
	MarginOptions,
	ViewChangeOptions,
	ViewCreator2dOptions,
	ViewCreator3dOptions,
	GlobalLocationArea,
	GlobalLocation,
	Decorator,
	SelectedViewportChangedArgs,
	ExtentLimits,
	FlashSettingsOptions,
	MarkerImage,
	MarkerFillStyle,
	MarkerTextAlign,
	MarkerTextBaseline,
	CanvasDecorationList,
	GraphicPrimitive,
	GraphicList,
	TextureCacheKey,
	TextureOwnership,
	TextureImageSource,
	SelectionSetEvent,
	GpuMemoryLimit,
	ToolType,
	ToolList,
	ParseKeyinResult,
} from "@itwin/core-frontend";

export {
	BackgroundMapType,
	GlobeMode,
	BriefcaseIdValue,
	SyncMode,
	TypeOfChange,
	ChangesetType,
	BisCodeSpec,
	CommonLoggerCategory,
	QueryRowFormat,
	MonochromeMode,
	ECSqlValueType,
	ChangeOpCode,
	ChangedValueState,
	ECSqlSystemProperty,
	SectionType,
	Rank,
	FeatureOverrideType,
	BatchType,
	FontType,
	Npc,
	GeoCoordStatus,
	ElementGeometryOpcode,
	GeometryStreamFlags,
	FillDisplay,
	BackgroundFill,
	GeometryClass,
	GeometrySummaryVerbosity,
	FillFlags,
	HSVConstants,
	ImageBufferFormat,
	ImageSourceFormat,
	LinePixels,
	MassPropertiesOperation,
	TextureMapUnits,
	PlanarClipMaskMode,
	PlanarClipMaskPriority,
	SkyBoxImageType,
	SpatialClassifierInsideDisplay,
	SpatialClassifierOutsideDisplay,
	TerrainHeightOriginMode,
	ThematicGradientMode,
	ThematicGradientColorScheme,
	ThematicDisplayMode,
	TxnAction,
	GridOrientationType,
	RenderMode,
	ColorByName,
	ColorDef,
} from "@itwin/core-common";

export type {
	AnalysisStyleDisplacementProps,
	AnalysisStyleThematicProps,
	AnalysisStyleProps,
	BackgroundMapProps,
	DeprecatedBackgroundMapProps,
	LocalBriefcaseProps,
	RequestNewBriefcaseProps,
	CameraProps,
	ChangedElements,
	EntityIdAndClassId,
	ChangedEntities,
	ChangesetIndexAndId,
	ChangesetIdWithIndex,
	ChangesetRange,
	CutStyleProps,
	ClipStyleProps,
	CodeProps,
	QueryLimit,
	QueryQuota,
	BaseReaderOptions,
	QueryOptions,
	ContextRealityModelProps,
	ContextRealityModelsContainer,
	DisplayStyleSubCategoryProps,
	DisplayStyleModelAppearanceProps,
	DisplayStylePlanarClipMaskProps,
	DisplayStyleSettingsProps,
	DisplayStyle3dSettingsProps,
	DisplayStyleProps,
	DisplayStyle3dProps,
	DisplayStyleOverridesOptions,
	DisplayStyleSettingsOptions,
	FunctionalElementProps,
	ViewAttachmentLabelProps,
	CalloutProps,
	NavigationValue,
	NavigationBindingValue,
	RelatedElementProps,
	ElementProps,
	GeometricElementProps,
	Placement3dProps,
	Placement2dProps,
	GeometricElement3dProps,
	PhysicalElementProps,
	SectionDrawingProps,
	SectionDrawingLocationProps,
	GeometricElement2dProps,
	GeometryPartProps,
	ViewAttachmentProps,
	SubjectProps,
	SheetProps,
	DefinitionElementProps,
	TypeDefinitionElementProps,
	PhysicalTypeProps,
	InformationPartitionElementProps,
	DisplayStyleLoadProps,
	RenderTimelineLoadProps,
	ElementLoadOptions,
	ElementLoadProps,
	ElementAspectProps,
	ExternalSourceAspectProps,
	ChannelRootAspectProps,
	LineStyleProps,
	CategoryProps,
	SubCategoryProps,
	UrlLinkProps,
	RepositoryLinkProps,
	RenderTimelineProps,
	AppearanceOverrideProps,
	EmphasizeElementsProps,
	EntityProps,
	SourceAndTarget,
	RelationshipProps,
	EntityQueryParams,
	EnvironmentProps,
	FeatureAppearanceProps,
	FeatureAppearanceSource,
	FeatureAppearanceProvider,
	FontMapProps,
	Helmert2DWithZOffsetProps,
	AdditionalTransformProps,
	CartographicProps,
	HorizontalCRSExtentProps,
	HorizontalCRSProps,
	VerticalCRSProps,
	GeographicCRSProps,
	ElementGeometryDataEntry,
	XyzRotationProps,
	GeocentricTransformProps,
	PositionalVectorTransformProps,
	GridFileDefinitionProps,
	GridFileTransformProps,
	GeodeticTransformProps,
	GeodeticDatumProps,
	GeodeticEllipsoidProps,
	GeometryAppearanceProps,
	AreaFillProps,
	MaterialProps,
	GeometryPartInstanceProps,
	GeometryStreamHeaderProps,
	GeometryStreamEntryProps,
	TextStringPrimitive,
	ImagePrimitive,
	PartReference,
	BRepPrimitive,
	GeometryPrimitive,
	GeometryStreamIteratorEntry,
	ImageGraphicProps,
	AffineTransformProps,
	ProjectionProps,
	Carto2DDegreesProps,
	TextStringProps,
	GeometryContainmentRequestProps,
	GeometryContainmentResponseProps,
	GeometrySummaryOptions,
	GeometrySummaryRequestProps,
	GroundPlaneProps,
	EcefLocationProps,
	RootSubjectProps,
	FilePropertyProps,
	ModelIdAndGeometryGuid,
	SolarLightProps,
	AmbientLightProps,
	HemisphereLightsProps,
	FresnelSettingsProps,
	LightSettingsProps,
	Localization,
	MassPropertiesRequestProps,
	MassPropertiesResponseProps,
	TextureMapProps,
	RenderMaterialAssetProps,
	RenderMaterialProps,
	ModelClipGroupProps,
	ElementIdsAndRangesProps,
	ModelGeometryChangesProps,
	ExtantElementGeometryChange,
	DeletedElementGeometryChange,
	ModelGeometryChanges,
	ModelProps,
	ModelLoadProps,
	ModelQueryParams,
	GeometricModelProps,
	GeometricModel2dProps,
	GeometricModel3dProps,
	PlanarClipMaskProps,
	PlanProjectionSettingsProps,
	RgbColorProps,
	RpcActivity,
	SessionProps,
	SkyCubeProps,
	SkyBoxProps,
	SolarShadowSettingsProps,
	SpatialClassifierFlagsProps,
	SpatialClassifierProps,
	SpatialClassifiersContainer,
	TerrainProps,
	TextureProps,
	TextureLoadProps,
	TextureData,
	ThematicGradientSettingsProps,
	ThematicDisplaySensorProps,
	ThematicDisplaySensorSettingsProps,
	ThematicDisplayProps,
	ThumbnailFormatProps,
	ThumbnailProps,
	GraphicsRequestProps,
	PersistentGraphicsRequestProps,
	JsonGeometryStream,
	FlatBufferGeometryStream,
	DynamicGraphicsRequestProps,
	DynamicGraphicsRequest2dProps,
	DynamicGraphicsRequest3dProps,
	TileVersionInfo,
	ViewDetailsProps,
	ViewDetails3dProps,
	ViewFlagProps,
	SectionDrawingViewProps,
	ViewStateProps,
	ViewStateLoadProps,
	ModelSelectorProps,
	CategorySelectorProps,
	ViewQueryParams,
	ViewDefinitionProps,
	ViewDefinition3dProps,
	SpatialViewDefinitionProps,
	ViewDefinition2dProps,
	AuxCoordSystemProps,
	AuxCoordSystem2dProps,
	AuxCoordSystem3dProps,
	WhiteOnWhiteReversalProps,
	BackgroundMapProviderName,
	PersistentBackgroundMapProps,
	Base64EncodedString,
	BriefcaseId,
	EntityIdAndClassIdIterable,
	ChangesetId,
	ChangesetIndex,
	ChangesetIndexOrId,
	CodeScopeProps,
	ColorDefProps,
	PlacementProps,
	FontId,
	UnitType,
	GeodeticTransformMethod,
	GridFileFormat,
	GridFileDirection,
	GeometryStreamProps,
	GeometryStreamPrimitive,
	ImageGraphicCornersProps,
	AxisAlignedBox3d,
	AxisAlignedBox3dProps,
	ElementAlignedBox3d,
	ElementAlignedBox2d,
	LocalAlignedBox3d,
	Placement,
	ProjectionMethod,
	HemisphereEnum,
	DanishSystem34Region,
	RemoveFunction,
	RgbFactorProps,
	Point2dProps,
	ElementGeometryChange,
	SkyBoxImageProps,
	TerrainProviderName,
	ElementGraphicsRequestProps,
	TweenCallback,
	UpdateCallback,
	EasingFunction,
	InterpolationFunction,
	ViewFlagsProperties,
	ViewFlagOverrides,
} from "@itwin/core-common";

// END GENERATED CODE
